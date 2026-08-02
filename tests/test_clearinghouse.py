"""Clearinghouse layer: 999/277CA parsing and the claim lifecycle machine."""

import pytest

from rcm.clearinghouse.acks import AckParseError, parse_277ca, parse_999
from rcm.clearinghouse.lifecycle import ClaimLifecycle, ClaimStatus, IllegalTransition

ACCEPTED_999 = (
    "ISA*00*          *00*          *ZZ*CLEARINGHOUSE  *ZZ*SUNRISECLINIC  "
    "*260802*1000*^*00501*000000201*0*P*:~"
    "GS*FA*CLEARINGHOUSE*SUNRISECLINIC*20260802*1000*201*X*005010X231A1~"
    "ST*999*0001*005010X231A1~"
    "AK1*HC*1*005010X222A1~"
    "AK2*837*0001*005010X222A1~"
    "IK5*A~"
    "AK9*A*1*1*1~"
    "SE*6*0001~"
    "GE*1*201~"
    "IEA*1*000000201~"
)

REJECTED_999 = (
    "ST*999*0002*005010X231A1~"
    "AK1*HC*2*005010X222A1~"
    "AK2*837*0002*005010X222A1~"
    "IK3*SV1*22**8~"
    "IK5*R*5~"
    "AK9*R*1*1*0~"
    "SE*7*0002~"
)

MIXED_277CA = (
    "ST*277*0001*005010X214~"
    "BHT*0085*08*277CA001*20260802*1000*TH~"
    "TRN*2*CLM-1001~"
    "STC*A2:20*20260802*WQ*168.50~"
    "TRN*2*CLM-1002~"
    "STC*A3:21*20260802*U*278.25********Invalid subscriber ID~"
    "SE*7*0001~"
)


class TestParse999:
    def test_accepted(self):
        ack = parse_999(ACCEPTED_999)
        assert ack.functional_group_accepted
        assert ack.transaction_accepted
        assert ack.accepted
        assert ack.error_codes == []

    def test_rejected_with_error_codes(self):
        ack = parse_999(REJECTED_999)
        assert not ack.accepted
        assert not ack.transaction_accepted
        assert "5" in ack.error_codes
        assert "IK3:SV1" in ack.error_codes

    def test_missing_ak9_raises(self):
        with pytest.raises(AckParseError, match="AK9"):
            parse_999("ST*999*0001~SE*2*0001~")


class TestParse277CA:
    def test_mixed_accept_reject(self):
        acks = parse_277ca(MIXED_277CA)
        assert len(acks) == 2
        by_claim = {a.claim_id: a for a in acks}
        assert by_claim["CLM-1001"].accepted
        assert by_claim["CLM-1001"].category_code == "A2"
        assert not by_claim["CLM-1002"].accepted
        assert by_claim["CLM-1002"].status_code == "21"
        assert by_claim["CLM-1002"].message == "Invalid subscriber ID"

    def test_unknown_category_raises(self):
        bad = "TRN*2*CLM-X~STC*Z9:1*20260802~"
        with pytest.raises(AckParseError, match="Unknown 277CA"):
            parse_277ca(bad)

    def test_no_claims_raises(self):
        with pytest.raises(AckParseError, match="no TRN/STC"):
            parse_277ca("ST*277*0001~SE*2*0001~")


class TestLifecycle:
    def test_happy_path_to_paid(self):
        lc = ClaimLifecycle(claim_id="CLM-1001")
        lc.advance(ClaimStatus.SUBMITTED_TO_CLEARINGHOUSE)
        lc.apply_clearinghouse_ack(accepted=True)
        lc.advance(ClaimStatus.PAYER_RECEIVED)
        lc.advance(ClaimStatus.PAID)
        assert lc.is_terminal
        assert lc.history == [
            ClaimStatus.GENERATED,
            ClaimStatus.SUBMITTED_TO_CLEARINGHOUSE,
            ClaimStatus.CLEARINGHOUSE_ACCEPTED,
            ClaimStatus.PAYER_RECEIVED,
            ClaimStatus.PAID,
        ]

    def test_rejection_allows_resubmit(self):
        lc = ClaimLifecycle(claim_id="CLM-1002")
        lc.advance(ClaimStatus.SUBMITTED_TO_CLEARINGHOUSE)
        lc.apply_clearinghouse_ack(accepted=False, reason="999 IK5 R")
        assert lc.status == ClaimStatus.CLEARINGHOUSE_REJECTED
        lc.advance(ClaimStatus.SUBMITTED_TO_CLEARINGHOUSE)
        assert lc.status == ClaimStatus.SUBMITTED_TO_CLEARINGHOUSE

    def test_denied_can_become_paid_after_overturn(self):
        lc = ClaimLifecycle(claim_id="CLM-1003")
        lc.advance(ClaimStatus.SUBMITTED_TO_CLEARINGHOUSE)
        lc.apply_clearinghouse_ack(accepted=True)
        lc.advance(ClaimStatus.PAYER_RECEIVED)
        lc.advance(ClaimStatus.DENIED)
        lc.advance(ClaimStatus.PAID)
        assert lc.status == ClaimStatus.PAID

    def test_illegal_transition_raises(self):
        lc = ClaimLifecycle(claim_id="CLM-1004")
        with pytest.raises(IllegalTransition, match="generated -> paid"):
            lc.advance(ClaimStatus.PAID)

    def test_paid_is_terminal(self):
        lc = ClaimLifecycle(
            claim_id="CLM-1005", status=ClaimStatus.PAID, history=[ClaimStatus.PAID]
        )
        with pytest.raises(IllegalTransition):
            lc.advance(ClaimStatus.DENIED)
