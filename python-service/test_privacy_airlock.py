import unittest
from privacy_guard import PrivacyAirlock

class TestPrivacyAirlock(unittest.TestCase):
    def setUp(self):
        self.airlock = PrivacyAirlock()

    def test_redact_email(self):
        text = "Contact me at john.doe@example.com for more info."
        expected = "Contact me at [EMAIL_REDACTED] for more info."
        self.assertEqual(self.airlock.redact_pii(text), expected)

    def test_redact_credit_card(self):
        text = "Payment via card 4111 1111 1111 1111."
        expected = "Payment via card [FINANCIAL_ID_REDACTED]."
        self.assertEqual(self.airlock.redact_pii(text), expected)

    def test_redact_phone(self):
        text = "Call me at +1 555 123 4567."
        expected = "Call me at [PHONE_REDACTED]."
        self.assertEqual(self.airlock.redact_pii(text), expected)

    def test_mixed_pii(self):
        text = "Email: test@test.com, Card: 1234-5678-9012-3456"
        expected = "Email: [EMAIL_REDACTED], Card: [FINANCIAL_ID_REDACTED]"
        self.assertEqual(self.airlock.redact_pii(text), expected)

if __name__ == '__main__':
    unittest.main()
