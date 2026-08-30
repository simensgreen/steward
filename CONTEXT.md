# Steward

Steward links Household Stock with money-aware Shopping and Budgets/Funds. Shopping Lists hang off a Budget or Fund. Recipes and Products are instance-global. People and Households each may have multiple Calendars. Primary deployment is self-host; hosted offering may come later. Full CRUD HTTP API is the system of record; MCP exposes a thin `crud`-style surface over resource types.

## Language

### People and Households

**Steward**:
The product: a web/PWA platform for running a household.
_Avoid_: home OS, family OS, Grocy-clone

**Person**:
A human identity in Steward. Owns a personal Budget, has a Default Currency, may create personal Calendars and **Calendar Views**, and may be a Member/Guest of many Households and Funds. Has no mandatory system Calendars. Accepting an invite uses an existing Person or **creates** one if the invitee has none yet.
_Avoid_: user (in domain talk), account (auth only); separate anonymous Guest account as the default identity model

**Household**:
A named domestic unit that owns Stock, system Calendars (`expiry`, `meal_plan`), optional custom Calendars, and membership. Does **not** own Budgets, Funds, Shopping Lists, or the Recipe/Product catalogs.
_Avoid_: home, family, workspace, tenant (in product language)

**Guest**:
A limited invitee to a Household, Fund, or a specific **event/occasion**—a scoped membership on a **Person**, not a separate anonymous account. Capabilities: read plus narrow write; not Budget/Rule admin. On a Fund, Guest is a **Fund Participant** with Member Balance. Post-event access policy is set on the invite (default: auto-revoke when ended and balances clear both ways).
_Avoid_: anonymous public link without identity (unless later allowed); Guest without balance when Fund money is in scope

**Default Household**:
The Household used for the current session when the Person has not explicitly switched. If they belong to exactly one Household, the UI never prompts for a choice. If several, last-used or pinned Default Household applies without a mandatory picker on every action.
_Avoid_: active household (unless meaning the in-session selection), current tenant

**Member**:
A Person's full membership in a Household (or full Fund membership vs Guest). v1 Household: equal capabilities except **Owner**. Authorization is checked per resource and command—Household membership does not imply Fund admin or privileged Revisions.
_Avoid_: user, account

**Owner**:
Controls membership for a Household or Fund. May force-remove a Fund Participant and trigger obligation redistribution (to Owner or per Fund rules). Not a blanket “can rewrite anything” ACL.
_Avoid_: superuser who bypasses Accounting Entry immutability

### Stock

**Stock**:
Goods on hand in a Household, composed of Stock Entries.
_Avoid_: pantry, inventory (as the pillar name)

**Location**:
A storage place within a Household's Stock (e.g. pantry shelf, fridge, freezer). Fridge and freezer are Location kinds/capabilities, not separate pillars.
_Avoid_: storage, bin (unless a sub-location is introduced later)

**Stock Entry**:
A lot/batch of a Product in a Location: quantity and optional expiry. Consumption follows FEFO/FIFO over Entries.
_Avoid_: batch (OK as synonym), stock item

### Catalog and stores

**Product**:
An instance-level catalog entry (barcode, Open Food Facts linkage, nutrition, **Purchase Unit** / **Consumption Unit**, etc.). OFF lookup caches fields on the Product; manual edits win and are instance-wide with revision/source metadata. The same Product may appear in many Stores at different prices.
_Avoid_: item, article (as the catalog name); per-Household private Product clone as default

**Recipe**:
An instance-level catalog entry: ingredients (Products + quantities) and derived totals such as calories from ingredients. Not owned by a Household.
_Avoid_: dish, meal plan (meal plan lives on a Calendar)

**Store**:
A place where Products are bought; holds Store Prices and Promotions.
_Avoid_: shop (synonym OK in UI copy), vendor

**Store Price**:
The price of a Product at a Store in a currency. UI may also show the viewer's Default Currency equivalent at the **current** FX rate (not frozen).

**Promotion**:
A structured Store deal: Product or category, discount or special price, and a schedule (weekdays and/or date range).
_Avoid_: deal note, unstructured store memo (as the primary model)

### Money

**Budget**:
A Person's personal money ledger: Transactions, Rules, and Shopping Lists. Members typically spend and contribute from their own Budgets; a Fund tracks shared obligations separately.
_Avoid_: wallet; do not call a Fund a Budget in domain talk

**Fund**:
A shared money ledger for a set of People. Has its own Default Currency, optional Household link, Shopping Lists, Rules, a **Settlement Strategy**, and **Member Balances** derived from **Accounting Entries**. Members buy/spend themselves; purchases update balances by Strategy without forcing Money Requests.
_Avoid_: Budget Group, shared budget (prefer Fund), household budget

**Accounting Entry**:
An immutable Fund book line: normalized participant deltas in Fund Default Currency, a source command, and an idempotency key. Member Balance = latest **Revision** + sum of later Accounting Entries’ deltas.
_Avoid_: mutable running totals as source of truth; command-specific history formats that the balance engine must special-case

**Member Balance**:
A Person's position in a Fund, **derived** from Accounting Entries (and Revision). Positive = others owe them; negative = they owe.
_Avoid_: treating the displayed balance as an independently edited field outside Revision

**Revision**:
Exact Member Balance snapshot as of a boundary. Current = last Revision + later Accounting Entries. Revision payloads are immutable except **Revision 0**, updated when retention compacts old entries into it. Privileged actors may post a new Revision with explicit balances (special entry type). Compaction and Revision posting are serialized with accounting writes; each Revision records which entries it includes.
_Avoid_: mutating historical ordinary entries; soft-edit of past purchases; async compaction without a recorded boundary

**Data Retention**:
Configurable policy (e.g. 180 days): older ordinary Accounting Entries are removed and folded into Revision 0, preserving derived balances without unbounded history.
_Avoid_: silent deletion without Revision compaction

**Settlement Strategy**:
How shared activity is attributed when posting participant deltas (e.g. one payer, equal shares, custom shares). Changing strategy requires a **new Fund**.
_Avoid_: recalculating historical balances after an in-place strategy edit

**Fund Participant**:
A Person in a Fund as Member or Guest (with Member Balance). Ordinary leave is blocked while they owe anyone or anyone owes them. An **Owner** may force-remove a participant and must choose redistribution: **all onto the Owner**, or **per the Fund’s redistribution rules**.
_Avoid_: deleting a participant and silently dropping their balance; inventing an ad-hoc split scheme at remove time beyond those two choices

**Purchase Unit** / **Consumption Unit**:
Units on a **Product**: how it is bought vs how Stock is consumed, with configured conversion and precision. Consumption rejects insufficient quantity; order is FEFO then FIFO, tie-break by stable Stock Entry id.
_Avoid_: a single unit with silent guesswork; negative stock by default

**Settle Up**:
Client-only convenience that pre-fills an in-Fund **Transfer** from Member Balances. Backend has no Settle Up command.
_Avoid_: Settle Up as a server entity or command

**Trust Level**:
Confirm-on-receive vs auto-accept for incoming money (Transfers / Money Request fulfillment). Person global default, overridable per Fund.
_Avoid_: autofill, silent accept (as names)

**Default Currency**:
(1) On a **Person**: preferred display currency. (2) On a **Fund**: reporting/accounting currency. Frozen FX on entries is relative to the owning ledger.
_Avoid_: system currency, Household base currency

**Transaction**:
A money movement on a personal **Budget** (Fund books use **Accounting Entry**). If currency differs from the ledger Default Currency, stores a frozen FX multiplier.
_Avoid_: payment (unless a specific kind); using Transaction for Fund participant deltas

**Transfer**:
Moves amount between ledgers or between two Fund participants. In-Fund Transfer is the backend primitive for paying someone in the Fund (any amount); confirm/auto follows Trust Level.
_Avoid_: using "transfer" for ordinary expense posts; Settle Up as a distinct server operation

**Money Request**:
Created by a creditor (positive Member Balance). Targets: whole Fund or a non-empty subset. Orchestrates in-Fund **Transfers** under normal Transfer rules (confirm / auto). When those Transfers have completed, the Request is satisfied if their amounts cover what was requested; individual Transfers may be for more or less than the requested slice.
_Avoid_: invoice; treating confirm as a no-op acknowledgement with a separate manual Transfer; using Money Request when the actor owes

**Rule**:
Automation on a Budget or Fund: trigger (inflow, outflow, or schedule), action (Transfer or create Money Request), amount (percent or fixed). Runs are deterministic and idempotent with an execution record.
_Avoid_: Recurring Transaction; cron; standing order (UI synonym OK)

### Shopping (hangs off money, not Household)

**Shopping List**:
Owned by exactly one Budget or Fund. Optional **target Household** for Stock receipt; if unset, use the list author's Default Household. Fund lists attribute purchases via Settlement Strategy into Accounting Entries.
_Avoid_: cart (cart is a state, not the list)

**Shopping Item**:
Lifecycle: needed → **In Cart** → **Purchased** (fully or in part). Tracks needed vs purchased quantity separately. Optional **Preferred Store** (default = Store with minimum known Store Price). **Purchased** requires a resolved **price**: use known Store Price when the Store is known (Store Trip View / list context / user-selected Store); otherwise the actor must enter the price before the command completes. Stock posts with the purchase; money posts with that resolved price.
_Avoid_: cart item as a separate aggregate unless required; all-or-nothing quantity; provisional zero-price accounting as the happy path

**Store Trip View**:
Derived view for a Person at a Store: not-yet-Purchased Shopping Items from lists associated with that Person that can be bought there. Operating in this view supplies Store context for price resolution.
_Avoid_: store shopping list (as an entity)

### Calendar

**Calendar**:
A named schedule of events. A **Household** always has system Calendars **`expiry`** and **`meal_plan`**, plus any number of custom Calendars. A **Person** has no system Calendars; they may create personal Calendars and/or **Calendar Views**.
_Avoid_: system `events` calendar; agenda (as entity name)

**Calendar View**:
A Person's read-only aggregation or pointer over Calendars they can see (e.g. Household calendars), without owning those Calendars.
_Avoid_: calling a View a Calendar

**Meal Plan Event**:
An event on a meal-plan Calendar: links a Recipe and portions; may optionally add missing ingredients to a Shopping List. Does not by itself reserve Stock unless a later rule says so.
_Avoid_: meal as free text only (as the primary model)

### External access and sync

**HTTP API**:
Full CRUD HTTP API over Steward resources; system of record for writes and integrations.

**SSE feed**:
Server-Sent Events stream of changes for live sync to clients (and as the preferred instant update path alongside REST).

**MCP surface**:
Agent access via a reduced tool surface (e.g. `crud` parameterized by resource type), façade over the HTTP API.
