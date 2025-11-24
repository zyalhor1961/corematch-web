"""
Test script for Privacy Airlock
Demonstrates PII redaction functionality
"""

from privacy_guard import airlock

# Test Case 1: Invoice with multiple PII types
test_invoice = """
Invoice #1024
Contact: sarah.connor@skynet.com
Phone: +1 555 0199 8888
Payment to IBAN: FR7630001000100010001000100
Credit Card: 4532 1488 0343 6467
Total Amount: €5000
"""

print("=" * 60)
print("TEST 1: Invoice with Multiple PII Types")
print("=" * 60)
print("\nOriginal Text:")
print(test_invoice)

result = airlock.inspect_traffic(test_invoice)

print("\n--- Security Report ---")
print(f"Safe to send to AI: {result['safe']}")
print(f"Flags detected: {', '.join(result['flags']) if result['flags'] else 'None'}")
print("\nSanitized Text:")
print(result['sanitized_content'])

# Test Case 2: Clean invoice (no PII)
clean_invoice = """
Invoice for professional services
Software development consulting
Total: €3000
"""

print("\n" + "=" * 60)
print("TEST 2: Clean Invoice (No PII)")
print("=" * 60)
print("\nOriginal Text:")
print(clean_invoice)

result2 = airlock.inspect_traffic(clean_invoice)

print("\n--- Security Report ---")
print(f"Safe to send to AI: {result2['safe']}")
print(f"Flags detected: {', '.join(result2['flags']) if result2['flags'] else 'None'}")
print("\nSanitized Text:")
print(result2['sanitized_content'])

# Test Case 3: Edge case - multiple emails
edge_case = """
From: alice@company.com
To: bob@client.com, charlie@vendor.com
CC: diane@accounting.com
"""

print("\n" + "=" * 60)
print("TEST 3: Multiple Emails")
print("=" * 60)
print("\nOriginal Text:")
print(edge_case)

result3 = airlock.inspect_traffic(edge_case)

print("\n--- Security Report ---")
print(f"Safe to send to AI: {result3['safe']}")
print(f"Flags detected: {', '.join(result3['flags']) if result3['flags'] else 'None'}")
print("\nSanitized Text:")
print(result3['sanitized_content'])

print("\n" + "=" * 60)
print("All tests completed!")
print("=" * 60)
