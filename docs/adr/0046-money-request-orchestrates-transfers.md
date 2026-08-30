# Money Request orchestrates Transfers

A Money Request does not itself move balances. It creates/tracks in-Fund Transfers under normal Transfer rules (Trust Level confirm or auto). When those Transfers have completed, the Request is satisfied if their amounts cover what was requested; a given Transfer may be for more or less than the originally suggested slice.
