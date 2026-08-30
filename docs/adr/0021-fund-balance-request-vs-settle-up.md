# Fund Member Balances; Request vs Transfer

A Fund derives Member Balances from the latest Revision plus later immutable entries (ADR-0032). Example (equal): Anya spent 100, Borya 50 → Anya +25, Borya −25. The creditor may **Money Request**; paying down a debt is an in-Fund **Transfer** between participants (ADR-0037)—the “Settle Up” button is only UI prefilling that Transfer.
