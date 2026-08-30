# Auth: local accounts, passkeys, guests

Self-host v1 uses local accounts (username/password) plus passkeys (WebAuthn). OIDC can come later. Invites may add full Members or **Guests** scoped to a Household, Fund, or a particular event/occasion. Guest: read + narrow write (shared-list aisle actions, event participation), not ledger admin. Post-event Guest access policy is configured on the invite; **default** is auto-revoke when the event has ended and balances are clear both ways (nobody owes the Guest, Guest owes nobody).

