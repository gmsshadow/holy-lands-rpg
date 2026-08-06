# Holy Lands RPG — v2.0.0 Migration Notes (Foundry v13/v14)

This release migrates the system from its v11-era architecture to the modern
Foundry API surface. **Minimum core version is now v13; verified on v14.**
Existing world data is untouched — all `system.*` field paths are identical to
v1.x, so actors and items load without a data migration.

## Hard v14 breaks fixed

- **`CONST.CHAT_MESSAGE_TYPES` removed in v14.** Every chat payload that set
  `type: CONST.CHAT_MESSAGE_TYPES.ROLL` (~20 sites across `actor.mjs`,
  `combat.mjs`, `holy-lands.mjs`) now simply omits the field — the presence of
  `rolls: [...]` is what marks a roll message. (`CHAT_MESSAGE_STYLES.ROLL` was
  also removed, so there is no direct substitution.)
- **`system.json` grid shim removed in v14.** Top-level
  `gridDistance`/`gridUnits` replaced with `"grid": {"distance": 5, "units": "ft"}`.
- **`{{#select}}` Handlebars helper removed in v14.** All templates now use
  `{{selectOptions choices selected=value}}`.
- Fixed the duplicated GitHub URL in `system.json`'s `url` field.

## template.json → DataModels

`template.json` is deleted. Actor and Item types are now `TypeDataModel`
classes in `module/data/`, registered via `CONFIG.Actor.dataModels` /
`CONFIG.Item.dataModels`. Field paths and defaults match the old template
exactly, plus schema validation for free. Derived-data preparation moved into
the models:

- Character: abilities / life max / faith max in `prepareBaseData`; defense
  (needs embedded items) in `prepareDerivedData`.
- NPC: defense in `prepareDerivedData`.
- Shared logic lives in `module/data/helpers.mjs`.

Note: Life/Faith **max** are derived from class data + level, so the character
sheet now shows them read-only (editing them was always overwritten by prep).

## AppV1 → ApplicationV2 sheets

- `HolyLandsActorSheet` and `HolyLandsItemSheet` now extend
  `HandlebarsApplicationMixin(ActorSheetV2 / ItemSheetV2)`. One class per
  document; the per-type template is chosen in `_configureRenderParts`.
- All jQuery listeners replaced with the AppV2 `actions` system
  (`data-action` attributes in templates): `rollAttribute`, `rollAbility`,
  `rollSkill`, `rollSave`, `rollAttack`, `rollDamage`, `castMiracle`,
  `useBlessing`, `itemCreate`, `itemEdit`, `itemDelete`, `editImage`, `roll`.
- Tabs use the core AppV2 tab action + `tabGroups`; sheet templates no longer
  include a `<form>` wrapper (DocumentSheetV2 provides it) and submit on
  change.
- `{{editor}}` blocks replaced with `<prose-mirror>` elements fed enriched
  HTML from `_prepareContext`.
- Item rows remain draggable to the macro hotbar (dragstart wiring in
  `_onRender`).

## Dialog → DialogV2

All four dialogs (defense choice, target selection, difficulty factor ×2 call
sites) converted to `foundry.applications.api.DialogV2` (`wait`/`prompt`),
reading values from `button.form.elements` instead of jQuery.

## Deprecated globals replaced (removal scheduled v15)

- `Actors`/`Items` → `foundry.documents.collections.*`
- `ActorSheet`/`ItemSheet` (unregister targets) → `foundry.appv1.sheets.*`
- `renderChatMessage` hook → `renderChatMessageHTML` (HTMLElement,
  `querySelector`/`classList` instead of jQuery).
- The `loadTemplates` preload call was removed entirely — it referenced six
  partials in `templates/actor/parts/` that don't exist in the repo, and the
  Handlebars mixin compiles part templates on demand anyway.

## Behaviour fixes made along the way

These are deliberate changes, flagged for review:

1. **AtR reset bug.** v1.x called `_resetAtR` inside `prepareBaseData`, which
   reset `atRCurrent` to `atRMax` on *every* data preparation — consumed AtR
   could never actually display or persist. The reset now only happens via
   `Actor#resetAtRPersisted()` from the combat hooks (`combatStart`,
   `combatRound`), `Combat#nextRound`, and `Combat#resetAll`.
2. **Skill rolls never fired.** The sheet passed keys like `"gifts.gift1"` but
   `rollSkill` looked up `system.skills["gifts.gift1"]` (undefined).
   `rollSkill` now resolves the dot-path with `foundry.utils.getProperty`, and
   uses the user-entered skill name in chat flavor when present.
3. **Target selection filter.** The old filter
   `a.id !== this.actor.id && a.type === 'character' || a.type === 'npc'` had
   an operator-precedence bug that let an NPC target itself. Now
   `(a.id !== actor.id) && ["character","npc"].includes(a.type)`.
4. **`consumeAtR`** now updates the specific
   `system.weaponSkills.<key>.atRCurrent` path instead of writing back the
   whole prepared `weaponSkills` object (which would have persisted derived
   state).
5. **Gift slot labels** gift4–gift7 were all labelled "Gift 3" in
   template.json; the data model gives each slot its correct label.
6. **`HolyLandsDice.rollSave`** read `actor.system.saves[name]` as a number;
   saves are objects, so it now reads `.value`.
7. Item lists on the actor sheet are sorted by Foundry's `sort` value, and
   armor/equipment rows gained an edit control (previously delete-only).

## Not done (future work)

- Compendium packs, localization keys in `lang/en.json` (templates still use
  hard-coded English labels).
- The "free counter-attack" TODO on a natural-20 defense is unchanged.
- NPC attacks still route through character-style `weaponSkills` (NPCs have
  `combat.attack`/`combat.damage` fields that the attack pipeline ignores),
  same as v1.x.

## v2.0.2 — Rules-fidelity fixes (verified against Genesis)

1. Save vs Using Magic DF corrected 19 → 21 (Ch3).
2. Half Rolls now halve the natural die (rounding up) before adding Bonuses
   (Ch1); previously the post-bonus total was halved.
3. A successful Dodge/Defend no longer costs the defender an AtR — AtR is
   lost only by attacking or taking Damage (Ch5). Chat now notes the
   defender's return-attack opportunity.
4. Blessings now cost 5 Faith to perform, with an insufficient-Faith check
   (Ch11).
5. The sheet's shift-click damage button is explicitly Natural-20 Double
   Damage (dice ×2, then Bonus — the correct order for that case); flavor
   text updated. The Advanced-Combat Critical strike remains unimplemented.
6. Armor degradation is one step per qualifying blow (damage ≥ CAP → −1
   aDEF, or −1 PEN once aDEF is 0), not floor(damage/CAP) steps (Ch9).
7. Grace Effect rerolls only the individual dice showing 1 (via the
   recursive reroll modifier, e.g. 3d4rr1), not the whole pool (Ch6).
8. The "Use Critical Rolls" world setting is now honoured: it gates the
   crit annotations on attribute/ability/skill/save rolls and the chat-card
   highlighting. Combat-pipeline natural 20/1 effects are mandated by Ch5
   and remain always on.
9. Life and Faith maxima are stored, editable values again (creation is
   STR + END + class die; level-ups add a rolled die — Ch6), no longer
   derived from classData averages. Current values still clamp to max.
10. Life can go negative down to the character's negative maximum (coma
    range); dropping to 0 or below posts a Save vs. Death prompt in chat
    (Ch3, "Death and Comas").
11. Miracle default Faith Cost is now 7 (all Level 1 Miracles are Fc 7).

## v2.0.3

- The character sheet's Class dropdown now only offers classes valid for the
  selected Stature (Genesis p.53). If a Stature change leaves the stored
  class invalid, it remains selectable, flagged "(invalid for Stature)", so
  the sheet never silently changes a character's class.

## v2.0.3

- The Class dropdown is now filtered by the character's Stature per the
  table on Genesis p.53 (Step 1). Changing Stature re-renders the sheet and
  updates the available classes. If the stored class is illegal for the new
  Stature it remains selectable, flagged "(invalid for Stature)", so no data
  is silently rewritten.

## v2.1.0 — Combat core automation

- **Advantage Natural 20/1** (Ch5): rolling initiative now detects natural
  20s and 1s. Nat 20 grants +3 to Attack/Critical/Special until the end of
  the Round or the actor takes Damage; Nat 1 imposes −3 on Dodge/Defend
  until the end of the Round or the actor lands a hit. Both are tracked as
  actor flags, announced in chat, and cleared automatically.
- **Forfeit Advantage**: new Combat-tab button; the next Dodge/Defend this
  Round rolls with double Bonus (consumed on use, cleared each Round).
- **Retreat**: new Combat-tab button. Forfeits Advantage (2× Dodge) and all
  attacks; the defender is forced to Dodge, and a successful Dodge of the
  initial Attack breaks away for the Round. Characters with the Sins of
  Pride, Control, or Strife get a chat reminder of the required Save vs. Sin.
- **Return attacks** (Ch5): after a successful Dodge/Defend, the defender is
  prompted to strike back immediately with their equipped weapon if they
  have AtR remaining (normal attack, all rules apply).
- **Natural 20 defense free counter-attack**: now automated - no AtR cost,
  and exempt from all Natural 20/1 riders on both sides per "it is either
  successful or unsuccessful" (which also prevents counter-chains).
- **Critical strikes** (Advanced Combat): the attack dialog offers Critical
  ×2..×N up to the weapon skill's current AtR. Rolls with the Critical
  Bonus (capped at the Attack Bonus with a warning, per the rule), spends
  AtR equal to the multiplier, and Damage is (dice + Damage Bonus) × N -
  the one bonus-before-multiply exception.
- **Special attacks (basic)**: rolls with the Special Bonus; the named
  maneuvers (Simultaneous, Knock-out, Stunning Strike, Sweeping) remain
  manual for now.
- **Situational modifier** input on the attack dialog covers Flanking
  (+1 per participating ally) and Rac-awarded bonuses.
- **Natural 20 attacks auto-hit** through the defense comparison unless the
  defender also rolls a Natural 20 (ties go to the defender).
- The defense prompt now surfaces active state (forfeited Advantage, Nat 1
  Advantage penalty, pending Half Roll) so the defender can see what will
  apply before rolling.
- AGI initiative tie-break was already present in `_sortCombatants`.

## v2.1.1

- Gifts/Talents/Crafts fixed: skill PF totals (`mod`) are now computed in
  data preparation, so entered PFs actually add to skill rolls (previously
  `mod` was never calculated and rolls added +0). The sheet now shows a
  single "+ PF" box per skill matching the official character sheet; the
  `bonus` field remains in the schema (hidden, default 0) so existing world
  data and any stored bonuses stay valid and still count.

## v2.1.2

- Gifts/Talents/Crafts now use ONLY the single visible PF box: `mod` mirrors
  `value` exactly, and the legacy hidden `bonus` field has been removed from
  the skill schema. Any values stored in the old second box are stripped by
  schema cleaning and no longer contribute to rolls. (Ability and Weapon
  Skill bonus fields are unrelated and unchanged.)

## v2.2.0 — NPC & Monster stat-block sheet

- NPCs rebuilt around the two stat-block layouts (Human NPC / Monster),
  selected with a new `npcKind` field; one sheet serves both.
- **Creature category** (Christian / Non-Christian / Demon) drives every
  save's DF from the three-column table on Genesis pp.24-27 (e.g. Sin
  10 [19 | 21], Using Magic 21 [3 | 0], Holy Item 7 [13 | 15]); each save
  also has an optional per-save DF override, plus its bonus and roll button.
- **CS (Notable Skills and Abilities)**: add/remove name +value rows with a
  d20 roll button each (stored as an ArrayField; edits rebuild the array to
  avoid unreliable numeric-key form merges).
- **WS**: NPCs now have the full seven weapon skills (ATT/CRI/SPC, AtR
  current/max) - the same schema as characters, so NPC attacks route
  through the complete combat automation (Criticals, counters, AtR).
- **tDEF override + source** on the shared defense schema, for natural
  armor like "hardened muscle and flesh [15]"; leave blank to use nDEF +
  equipped armor as before.
- Monster-only fields (shown when Kind = Monster): Life range, size, EXP
  value/range, and a Features text block.
- Weapons and Armor item lists (with attack/damage buttons) on the NPC
  sheet; the embedded-skill-items context key was renamed to `skillItems`
  to avoid clashing with the new CS array.

## v2.3.0 — Character creation: combat point budgets (Steps 7-8)

- The Combat tab now tracks point budgets granted by skills, matched by
  name from Gifts/Talents/Crafts:
  - **Combat Abilities** (Step 7): the skill's PF grants that many +1s to
    distribute across ADV/DOD/DEF/DAM. A spent/budget chip shows on the
    Combat Bonuses header (red when overspent), with a hint when the skill
    is missing. The Rule of Halves (p.55) is checked on the group: once the
    highest Bonus exceeds +7, the second highest must be at least half.
  - **Weapon Skills** (Step 8): each "WS <name>" skill's PF grants +1s for
    that Weapon Skill's ATT/CRI/SPC. Per-skill spent/budget chips, plus
    warnings when CRI or SPC exceeds ATT.
  - **AtR**: expected AtR shown per Weapon Skill (base 1, or 2 for Hand to
    Hand / Paired Weapons, +1 for having the WS skill), flagged when the
    entered maximum differs - as a warning only, since Rac awards (e.g.
    AGI 12+) legitimately change it.
- All validation is soft (warnings, nothing blocked), computed in derived
  data so it updates live as skills or bonuses change. Name matching is
  case-insensitive and tolerant ("WS Light Arms", "light arms", etc).

## v2.4.0 — Class items and the Character Classes compendium

- New **class** Item type carrying the Ch7 mechanics: attribute
  requirements, Life creation die (STR + END + die; note Knight/Warrior use
  1d8), Life per-level die (1d6 for Cleric/Devil Hunter/Fighter/Knight/
  Saisier/Warrior, 1d4 others), Faith creation formula (attribute keys +
  die - e.g. Cleric PAT + VIR + 1d6, Saint PAT + VIR + 1d8), Faith
  per-level die (Saint 1d6, others 1d4), legal Statures, Blessings type,
  granted Gifts, and starting equipment text.
- **Character Classes compendium** (packs/classes) ships all 13 classes,
  built from JSON sources in packs/_source/classes via the Foundry CLI
  (rebuild with compilePack after editing sources). Gift lists and
  equipment are starter data - verify against Ch7.
- **Drop a class on a character**: replaces any existing class item, syncs
  the class key (keeping stature-filter compatibility), and offers to roll
  starting Life & Faith from the class formulas (Grace Effect honoured via
  rr1). A warning shows if the character's Stature is illegal for the
  class's own Ch7 list.
- **Level Up button** (header, when a class is assigned): confirms, then
  +1 Level, rolls the class Life and Faith dice (GE) and adds each to both
  maximum and current (p.62), and posts a chat card with the rolls plus
  reminders for the manual gains: +1 Attribute, +1 Save (Rule of Halves),
  Talent/Craft picks by level, Miracle selections, and the expected
  Blessings count (2 per 5 max Faith).
- A **Start** button re-rolls starting Life & Faith for new characters.
- Without a class item the old dropdown remains, so nothing breaks for
  existing characters; the sheet hints at dropping a compendium class.

## v2.5.0 — Creation Step 2: Stature attribute rolling with lock-out

- The character header gains a **Roll Attributes** button next to Stature.
  After a confirmation naming the chosen Stature, it rolls all twelve
  Attributes from the p.53 dice table (WeeFolk 1d4 STR / 4d4 AGI & BTY;
  Dwarfolk 4d4 WIL/STR/END, 2d4 PAT/SPD/CHA; CommonFolk 3d4 across;
  GiantFolk 5d4 STR, 4d4 END, 2d4 PAT/SPD/BTY/CHA), honouring the Grace
  Effect world setting (rr1), assigns every AV, and posts a chat card with
  each roll.
- The roll then **locks**: the Stature dropdown disables, the button
  disappears, and rolling again is refused (`system.creation.attributesRolled`).
  The chat card notes the Step 2A allowance - rerolling class
  Primary/Secondary Attributes until requirements are met, at the Rac's
  discretion.
- GMs see a small **unlock** link (with confirmation) to reset the lock for
  corrections; players cannot unlock.
- Existing characters are unaffected: the flag defaults to unlocked, so
  they simply see the new button until it's used.

## v2.6.0 — Step 2A: class attribute requirement rerolls

- Class items now carry structured Primary/Secondary Attribute requirements
  (attribute key + minimum AV); all 13 compendium classes populated from
  Ch7 (Adventurer and Fighter have none). The class item sheet gains
  editable fields for them.
- After Step 2 locks, if the assigned class's requirements are unmet the
  character header shows per-attribute warnings and a **Step 2A Reroll**
  button. On confirmation each unmet Attribute is rerolled with the
  Stature's own dice (GE) repeatedly until the requirement is met (p.53),
  leaving all other Attributes locked; the chat card reports each
  Attribute's old AV, final AV, and how many rolls it took (attempt cap of
  200 guards impossible dice/requirement combinations).
- Once requirements are met the warnings and button disappear.

## v2.7.0 — Creation Step 4: Saving Throw Bonus (+ level-up integration)

- The Saving Throws header gains a **Step 4: +1 Save** button. It opens a
  picker listing all thirteen saves with their DF and current Bonus; the
  chosen save gains +1, the choice locks (`creation.saveBonusChosen`), and
  a chat card records it. GMs get the usual unlock link (the +1 itself is
  not reverted automatically).
- **Level Up now chains the same picker**: after the class dice are rolled
  and applied, the p.62 per-level +1 Saving Throw is offered immediately
  (cancellable - the chat reminder still covers it if skipped).
- **Rule of Halves on Saves** (p.55, threshold +3) is now checked in
  derived data: a warning appears under the Saving Throws header when the
  second-highest Bonus is below half the highest.

## v2.7.1

- Fixed: class Attribute requirement warnings were only shown for
  characters whose attributes were rolled through the Step 2 button
  (attributes rolled before v2.5.0 or entered manually never flagged).
  Warnings now show whenever a class item's requirements are unmet; the
  Step 2A Reroll button still requires the Step 2 lock (with a hint
  otherwise, since 2A needs a completed Step 2 roll to modify).
- Dropping a class whose requirements are unmet now offers the Step 2A
  reroll dialog immediately (before the starting Life/Faith offer, since
  Life depends on STR/END which a reroll may change); if Step 2 hasn't
  been rolled yet a notification explains the order.
- Drop handling made defensive against receiving raw drag data instead of
  an Item document (resolved via fromDropData).

## v2.7.2

- Dropping a class whose Ch7 Stature list excludes the character's Stature
  now asks for confirmation first, naming the legal Statures. Cancelling
  (the default button) leaves the character's existing class untouched;
  confirming is a Rac override and the persistent header warning remains.

## v2.7.3

- Class Attribute requirement validation now works on every path:
  - Requirements resolve from the class item's structured fields, falling
    back to parsing its requirements display text ("Charisma 10,
    Intellect 8"), falling back to a built-in Ch7 table keyed by the
    dropdown class. Legacy world-imported class items (pre-v2.6.0, with
    blank structured fields) and dropdown-only classes both validate now.
  - The warnings and Step 2A Reroll button moved outside the
    class-item-only template branch, so they display for dropdown classes
    too. Step 2A rerolls work without a class item (chat names the
    dropdown class).

## v2.7.4 — Creation ordering: Life & Faith protected from attribute changes

- Starting Life & Faith can no longer be rolled before Attributes (Step 2)
  are rolled and locked - the Start button shows a "roll Attributes first"
  hint, the class-drop offer is suppressed with a notification, and the
  actor method refuses with a warning.
- The starting roll now **locks after use** (`creation.startingRolled`),
  storing the rolled Life and Faith die results; GMs get an "unlock start"
  link. Level Up is unaffected.
- **Step 2A rerolls recompute Life & Faith with the original dice**: if the
  starting roll already happened and a 2A reroll changes STR/END or the
  class Faith attributes (PAT/VIR), Life and Faith max/current are
  recalculated as new attributes + the stored die results - the creation
  roll itself is never re-rolled. The 2A chat card reports the
  recalculation. Faith attributes come from the class item, with a built-in
  Ch7 fallback for dropdown classes.
- Existing characters default to unlocked and simply see the new gating.

## v2.8.0 — Class dropdown removed; compendium picker

- The class dropdown is gone: class items are now the single source of
  truth. In its place, a **Choose Class** button opens a picker listing the
  compendium classes legal for the character's current Stature (p.53
  filtering preserved), showing each class's attribute requirements, and
  noting how many classes the Stature hides. Assignment runs the same
  pipeline as drag-and-drop (Step 2A offer, starting-roll offer); the
  stature gate is skipped since the list is pre-filtered, while dragging an
  illegal class manually still hits the confirmation gate.
- The assignment pipeline was factored into a shared method used by both
  the drop handler and the picker.
- Characters with only the legacy class key display it as
  "<Class> (legacy)" beside the Choose Class button - assigning a class
  item upgrades them and keeps the key in sync. The built-in Ch7
  requirement/faith-attribute fallbacks remain for such characters.

## v2.9.0 — Step 5 details: gender, age range, details roll, Sins & Phobias

- **Gender** is now a Male/Female select (p.55).
- **Age** shows its legal p.56 range beside the label - minimum = highest +
  lowest AV, maximum = 2 x the sum of the two highest - with a warning when
  the entered age falls outside it (noting the Rac's Attribute-adjustment
  option for very young/old characters).
- **Roll Details** button (header): d12 Height from the Stature table,
  Weight looked up from the STR x height table with +10% for males, and
  d20 Native Land and Language Group (new fields, shown on the Biography
  tab). Everything remains editable afterwards for players who prefer to
  choose - the chat card says so.
- **Sins & Phobias finally have UI** (Biography tab): editable lists with
  add/remove rows, expected counts shown from VIR/WIL per the p.56 table
  (12+: 0 ... 4-5: 4), and Roll buttons that d20 the correct number of
  times against the twenty-entry tables, rerolling duplicates. Rolling
  overwrites the list after confirmation; rows stay editable. This also
  finally feeds the Retreat Pride/Control/Strife check real data.

## v2.10.0 — Skills as items (structural core)

- The fixed Gifts/Talents/Crafts slots are replaced by embedded **skill
  items**. The Skills tab keeps the three-column paper-sheet layout, but
  each column is now an item list (name → opens the item, +PF shown, roll
  and delete controls, and an Add button that creates a skill pre-set to
  that section). Dragging skill items in works too.
- **SkillData** extended: `pf` (the single +PF box), plus structured links
  that replace name-matching - `combatAbilities` (Step 7 budget) and
  `weaponSkillKey` (Step 8 budget + AtR) - and `prerequisite` /
  `isCombatSkill` metadata. The skill item sheet exposes all of these.
- **Combat-budget validation (Steps 7-8) now reads item data**: the
  Combat Abilities flag and weaponSkillKey drive the budgets directly, with
  the old name regex kept only as a fallback for hand-typed skills without
  the links set. Validation moved to derived data (it needs the items).
- **Skill rolls** now roll the embedded item by id (d20 + its PF).
- **Automatic migration**: on first load as GM, any character still holding
  legacy `system.skills` slots has them converted to skill items - section
  preserved, old value+bonus summed into PF, "Combat Abilities" and
  "WS <name>" recognised and linked, "CS " prefixes flagged - then the
  legacy data is cleared so it runs once. A notification reports the count.
- NPC "CS" notable-skills list is unaffected (separate ArrayField).

## v2.10.1

- Fixed: creating a skill item failed validation ("weaponSkillKey may not
  be a blank string"). A StringField with a choices list rejects "" even
  when it's listed; added blank:true so skills default to no Weapon Skill
  link as intended.

## v2.11.0 — Skills compendium

- New **Skills** compendium (packs/skills): 86 skill items covering the
  Chapter 4 list plus the seven Weapon Skills, the CS combat skills, and
  Combat Abilities. Built from JSON sources in packs/_source/skills via the
  Foundry CLI.
- Data is intentionally minimal - name, section default, prerequisite text
  (where certain), and the mechanical links only. **No rules descriptions
  are included**, so the compendium does not reproduce book text; players
  reference the rulebook for what each skill does.
- The mechanically important entries are pre-linked: each "WS <name>" skill
  carries its weaponSkillKey (drives the Step 8 budget and +1 AtR when
  dragged on), Combat Abilities has its combatAbilities flag (Step 7
  budget), and CS skills are flagged with prerequisites where known.
- Classes and Skills packs are grouped under a "Holy Lands RPG" compendium
  folder in the sidebar.
- Skills default to the Craft section; drag onto a character and move to
  Gifts/Talents as needed (Step 6 auto-population is the next piece).

## v2.12.0 — Step 6: skill auto-population

- **Grant Class Gifts** button appears on the Skills tab when a class with a
  Gift list is assigned (and Gifts haven't been granted yet). It adds the
  class's listed Gifts as skill items at +3 PF - or +2 for Adventurer and
  Fighter, whose Skills all start at +2 (p.58) - matching names against the
  Skills compendium so Weapon Skill / Combat Abilities links carry across,
  and creating plain skills for any unmatched names. Skips skills the
  character already has, then locks (creation.giftsGranted), and the chat
  card lists what was granted plus the Talent/Craft next steps.
- The per-column **Add buttons** now open a Skills-compendium picker into
  that section, defaulting to the step PF (Gift +3, Talent +2, Craft +1)
  and flagging skills already held - the guided way to pick the 5 Talents
  and 3 Crafts. Manual drag-and-drop still works.
- Note: the class item's Gift list is auto-granted, but the wider "class
  skill list" for Talent/Craft picks isn't stored as structured data (it
  couldn't be reliably extracted), so those picks are player-chosen from
  the full Skills compendium rather than restricted per class.

## v2.13.0 — Step 10: Attribute Bonuses (AV 12+)

- New Attribute Bonuses panel on the Attributes tab. For each Attribute at
  an even value >= 12, the character earns one bonus per threshold
  (12, 14, 16... - e.g. STR 15 = 2, STR 16 = 3), per p.60. Each row shows
  the Attribute, its effect, an applied/earned counter, and an Apply button
  while bonuses remain; a pending count shows in the header.
- Effects are applied correctly per Attribute: STR +1 Damage, SPD +1 Dodge,
  AGI +1 AtR (choose the Weapon Skill), PAT/END +1d4(GE) Faith/Life,
  BTY/CHA +2d4 x 50g, WIL +1 to a chosen Save, INT/WIS/MEM +1 PF to a
  chosen Craft/Gift/Talent, VIR remove a chosen Sin. Dice effects roll with
  the Grace Effect and post to chat; choice effects prompt a picker.
- Applied counts are tracked per Attribute (creation.attrBonusApplied), so
  the panel always shows what remains - this also covers the level-up case,
  since raising an Attribute past a new even threshold surfaces a new
  pending bonus. Rule-of-Halves-flagged choices (Craft/Gift/Talent/Save)
  are noted in the effect text; the existing RoH warnings still apply.

## v2.14.0 — Miracles compendium and selection

- New **Miracles** compendium (packs/miracles): the 15 Level-1 Miracles from
  Genesis Ch11 - 12 High, 3 Clerical - each carrying its structured stat
  block (Faith cost, Range, Duration, Target, Area, type, level). No rules
  descriptions, per the minimal-data approach (higher-level Miracles live in
  later books and can be added to the pack later).
- The Miracles tab now shows selection guidance for Saints and Clerics
  (Saint: 5 High + 2 Clerical; Cleric: all Clerical of level + 1 High) with
  Add High Miracle / Add Clerical Miracle pickers filtered by type, and a
  "Grant all Clerical" shortcut for Clerics. Non-clergy characters see the
  tab unchanged.
- Grouped with the other packs under the Holy Lands RPG compendium folder.

## v2.15.0 — Weapons compendium with stature damage/cost brackets

- **WeaponData** extended for the Ch8 three-way stature brackets: common/
  dwarf is the base `damage` and `cost.gold`; `damageWee`/`damageGiant` and
  `costWee`/`costGiant` hold the [wee | giant] variants. Helper
  damageForStature() returns the correct die by wielder Stature.
- **Attack pipeline is now stature-aware**: a weapon's damage roll uses the
  wielder's Stature bracket (a WeeFolk with a Battle Axe rolls 1d6, a
  GiantFolk 3d6, common/dwarf 2d6). The character weapon list shows the
  stature-correct damage too.
- **Shields** are modelled as weapons with isShield + a Defend-bonus bracket
  (common/dwarf [wee | giant]) and their attacking WS; the weapon sheet
  reveals the shield fields when ticked.
- New **Weapons** compendium (packs/weapons): all 57 Ch8 entries - Light
  Arms, Heavy Arms, Missile, Thrown, and the three Shields - each with full
  damage/cost brackets and correct Weapon Skill, no descriptions. Grouped
  under the Holy Lands RPG compendium folder.
- Note: ammunition and the per-stature ammo costs were left out of this
  first pass (they're consumables, not wielded items); can be added later.

## v2.16.0 — Armor compendium

- **ArmorData** gains cost brackets (costWee/costGiant) alongside the base
  common/dwarf cost, matching the Ch9 pricing; aDEF/PEN/CAP and the AP slot
  were already present and feed the existing equip/degradation logic.
- New **Armor** compendium (packs/armor): all 60 Ch9 pieces across the six
  Areas of Protection (Arms 9, Chest 25, Back 3, Feet 3, Head 9, Legs 11),
  each with aDEF, PEN, CAP, and cost brackets - no descriptions. Equip
  pieces on a character and the existing defense calc handles highest-aDEF-
  per-slot stacking, tDEF, armor penalty totals, and CAP degradation.
- The three remaining shields from the Ch9 opening (Small Battle Shield,
  Small Shield, Tower Shield) were added to the Weapons pack, which now
  holds 60 entries (6 shields total).
- The armor item sheet shows the cost brackets. Grouped under the Holy
  Lands RPG compendium folder.

## v2.17.0 — Equipment compendium

- New **Equipment** compendium (packs/equipment): all 74 Chapter 10 items
  (belts, packs, lanterns, rope, rations, instruments, tools, inks, tents,
  wound kit, etc.) with their costs - gold or silver as the book lists them
  (e.g. Lute 103g, Chalk Piece 20s, Preserved Rations 30s). No descriptions.
- Equipment has a single flat cost (no stature brackets or AP slots), so
  EquipmentData needed no changes; the existing equipment item sheet already
  covers quantity, cost, and weight. Grouped under the Holy Lands RPG
  compendium folder.
- All three gear categories (Weapons, Armor, Equipment) plus Skills,
  Miracles, and Classes now ship as compendia - the data foundation for
  Step 9 starting-equipment auto-grant.

## v2.18.0 — Step 9: starting equipment auto-grant (creation complete)

- **ClassData** gains a structured `startingKit` (name, qty, dice roll for
  quantity, 'or' options, and target compendium). All 13 classes populated
  from Ch7 with their common gear plus per-class weapons/armor.
- **Grant Starting Equipment** button on the Equipment tab (when a class
  with a kit is assigned and equipment isn't yet granted). It resolves each
  kit entry against the Weapons/Armor/Equipment compendia, rolls dice
  quantities (e.g. (1d4+1) rope, 2d4 rations), and for 'or' entries prompts
  the player to choose (Mace or Warhammer, etc). Locks after granting
  (creation.equipmentGranted); GM unlock link provided. Unmatched names are
  reported in chat rather than failing silently.
- Verified: all 13 classes' kits - and every 'or' option - resolve against
  the current compendia.
- This completes the Chapter 6 creation walkthrough end to end: Stature,
  Attributes (+2A rerolls), Abilities, Save, Details/Sins/Phobias, Skills
  (Step 6 grant), Combat budgets (Steps 7-8), Life/Faith, Attribute Bonuses
  (Step 10), Miracles, and now Starting Equipment (Step 9).

## v2.19.0 — Blessings entitlement count

- The Blessings section header now shows "held of entitled" (two Blessings
  per five points of maximum Faith, Ch11), turning red if over the limit,
  with the class's Blessings type shown alongside. Calculated live in
  derived data, so it updates at creation and as max Faith rises on level up.
- The Level Up chat card's Blessings reminder is now accurate: it compares
  the entitlement against Blessings actually held and states how many more
  may be selected, instead of only naming the target number.
- Note: this is count tracking only - granting Blessings still needs a
  Blessings compendium (Ch11) and a picker, planned for the next
  compendium pass.

## v2.20.0 — Blessings compendium

- **BlessingData** gains a `faithCost` field (default 5); the useBlessing
  action now reads it instead of a hardcoded constant, and the blessing
  item sheet exposes it.
- New **Blessings** compendium (packs/blessings): all 125 Blessings from
  Genesis Ch11, alphabetical, each with a blank description, Faith cost 5,
  and once-per-day Blessings (the book's asterisked entries) marked in their
  Duration. No rules text, per the minimal-data approach. Grouped under the
  Holy Lands RPG compendium folder.
- Count tracking (v2.19.0) already shows held-of-entitled on the sheet; a
  class-type-filtered picker to grant Blessings can follow, matching the
  miracle-selection pattern.

## v2.21.0 — Blessing auto-roll (p.61 tables)

- **Blessing tables** (Genesis p.61) added as data: the three d% tables -
  Courage, Duty, Fortune - each covering 0-99, with the class -> table
  mapping from the Ch7 descriptions (e.g. Adventurer/Scout/Spy/Voyager/
  Warrior/Jester = Fortune; Bard/Cleric/Saint = Duty; Fighter/Knight/Devil
  Hunter/Saisier = Courage).
- Fixed: class items' blessingsType corrected to the real three types
  (earlier data wrongly listed a non-existent "Wisdom" table).
- **Roll Blessings** button on the Blessings header (shown when the
  character is owed Blessings). It rolls d% on the class's table for each
  outstanding Blessing (entitled minus held), rerolling duplicates and any
  already held, and grants the matching Blessing items from the compendium.
  Verified: every one of the ~40 entries per table resolves to a compendium
  item (after aligning two "Use Magic" -> "Using Magic" names).
- Works at creation and level up alike - the button count follows the
  2-per-5-Faith entitlement tracked since v2.19.0.

## v2.22.0 — Playtest fixes

- **Details roll (Step 5):** native land and language are now one paired
  d20 roll (p.57 table) instead of two separate rolls, so the language
  group always matches the land. The sheet still lets you edit either, and
  the chat note reminds you that you may mix them if desired.
- **Classes - starting coinage:** ClassData gains coinage fields
  (coinGoldDie/Mult, coinSilverDie/Mult), populated per class from Ch7
  (gold die varies: Saint 1d4, Saisier 2d4, most 3d4, Bard/Cleric 4d4,
  Knight 5d4, Voyager 7d4; all x10 gold, plus 1d4x3 silver). The Step 9
  equipment grant now rolls coinage with the Grace Effect and adds it to the
  character's currency, reporting it in the chat card.
- **Adventurer:** requirements text cleared (the class has no attribute
  requirements) and faith-creation attributes blanked (it gains no Faith
  bonus from an attribute). Automation was already correct; this removes the
  misleading text.
- **Blessings - starting entitlement:** corrected understanding - a
  character gets two (2) Blessings only if max Faith is 5+, and none at 4 or
  below (p.60); the running total is still two per five-point threshold on
  level up (p.62). The count/roll now guards on Faith >= 5 explicitly.
- **Blessings - duration:** all 125 Blessings changed from blank/"Permanent"
  to "One Action" (p.60: a Blessing affects the character for one action
  unless otherwise specified). The 17 once-per-day Blessings read "One
  Action (once per day)" to keep that usage limit. BlessingData default is
  now "One Action" too.

## v2.23.0 — System background artwork

- Added the Holy Lands RPG title artwork (castle, cross-shield logo, three
  robed adventurers) to the system at assets/images/background.jpg.
- Wired it as the system background via the "background" line in system.json
  ("assets/images/background.jpg"), so it shows on the world setup / system
  screen in Foundry.

## v2.24.0 — Rac-chosen turn order & non-looping Return Attack

- Added the official **Combat Handbook** to documentation/ for reference.
- **Turn order (Combat Handbook, Section 5):** Holy Lands RPG does not use
  fixed D&D-style initiative. The highest Advantage roll still acts first,
  but the combat tracker no longer auto-advances through a sorted list.
  After each turn, the Rac is prompted to choose who acts next - and it may
  be the same combatant again. The picker lists each combatant's Advantage
  and remaining AtR; when everyone is out of AtR it rolls into the next
  Round (there's also an explicit End Round button). Non-GM clients fall
  back to default behaviour.
- **Return Attack is optional and does not loop (p.49):** the return/counter
  attack was already declinable, but a counter could previously grant the
  original attacker another counter, chaining. Attacks now carry an
  isCounter flag: a return or free counter-attack resolves once, then hands
  control back to the Rac with a chat note - no infinite counter loop.
  Declining a return attack likewise hands back to the Rac.

## v2.25.0 — Shared AtR pool & active attack type

- **AtR is now a single shared "actions this Round" pool.** Previously each
  Weapon Skill tracked AtR independently, so switching weapons handed you a
  fresh set of attacks. Now any action decrements EVERY Weapon Skill's AtR
  together (floored at 0) via spendActionAtR - attacking or being hit costs
  the whole pool one beat, and a Critical costs all pools its full multiplier
  (Combat Handbook Section 7: a CRI is the Round's focus poured into one
  blow, so it reduces every attack avenue). The attack pipeline and the
  damage-loss path both use this.
- **Active attack type:** characters and NPCs gain activeWeaponSkill (the
  weapon skill currently in use). The sheet shows its AtR (current/max) and a
  dropdown to change it any time - at rest or mid-combat. Attacking with a
  weapon auto-sets the active type to that weapon's skill (free counters
  don't change your stance).
- The combat tracker's turn picker and round-end check now read the ACTIVE
  skill's AtR rather than a sum across all skills, so "who has actions left"
  reflects the character's current weapon.

## v2.26.0 — Weapon-skill switching resolves as a Special (p.51)

- Completes the p.51 "Using two or more Weapon Skills in a single Round"
  rule on top of the shared-AtR-pool model. The first Weapon Skill a
  character attacks with in a Round is recorded as their opener; any later
  attack that Round with a DIFFERENT Weapon Skill is automatically resolved
  as a Special (using that skill's SPC Bonus), matching the book's example
  where a Light Arms opener followed by a Kick Attack is rolled as a Special
  with the remaining AtR.
- If a switched attack was declared as a Critical, it's demoted to a Special
  (multiplier reset to 1), since the switch itself must be a Special.
- The "all previous attacks that Round were successful" condition and the
  realism check (no sword-then-fist with hands full, etc.) are intentionally
  left to Rac discretion, as requested.
- The opener resets at the start of each Round; free counter-attacks are
  exempt and don't set or trigger the rule.

## v2.27.0 — Background path fix & Combat tab quick-access

- **Fixed the system background not displaying.** The "background" path was
  relative to the system folder, but Foundry resolves it from the data root,
  so it 404'd (broken-image icon). Corrected to
  "systems/holy-lands-rpg/assets/images/background.jpg" and also added the
  modern media[] setup entry (v10+ preferred) pointing at the same file.
- **Combat tab quick-access (PCs):** equipped weapons now appear as a "Ready
  Weapons" block at the very top of the Combat tab, each with Roll Attack /
  Roll Damage buttons, and the Active Attack Type selector (with live AtR)
  sits directly beneath them - the fastest path to acting in a fight. The
  Active Attack Type box was removed from its old spot under Weapon Skills
  (the full weapon list and WS detail remain below as before).
- Confirmed: activeWeaponSkill is a stored actor field, so it persists
  across sessions when set outside combat; and AtR reductions apply to all
  Weapon Skill pools from both attacking and being hit (all routes go
  through spendActionAtR).

## v2.28.0 — Innate unarmed attacks (Punch/Kick, p.48)

- Characters now have two permanent innate attacks - Punch and Kick - shown
  at the top of the Combat tab's Ready Weapons block (above equipped
  weapons), each with Roll Attack / Roll Damage buttons. They're virtual
  (not deletable items) and always present.
- **Unarmed damage now depends on BOTH Stature and Weapon Skill (p.48):**
  Punch is 1d2 untrained / 1d4 with WS Hand to Hand (wee 1|1d2, giant
  1d3|1d6); Kick is 1d3 untrained / 1d6 with WS Kick Attack (wee 1d2|1d4,
  giant 1d4|1d8). Having the relevant WS is detected from the character's
  Skill items (weaponSkillKey), and the row shows "(untrained)" when the WS
  is absent. All eight values verified against the book.
- Punch routes through WS Hand to Hand and Kick through WS Kick Attack, so
  they use the correct ATT/CRI/SPC bonuses, AtR, and the shared-pool and
  weapon-switch rules already in place. The attack pipeline was extended to
  accept these synthetic innate attacks.

## v2.29.0 — Equip toggle button on all gear

- Added an equip/unequip toggle button next to the Edit button on every
  weapon, armor, and equipment row - no more opening the item sheet just to
  change equipped state. The icon is a filled green shield when equipped and
  a faded outline when not, with a tooltip stating the current state.
- Equipping a weapon this way makes it appear immediately in the Combat tab's
  Ready Weapons block (and armor in the defense calc), since those already
  key off the equipped flag.
- Single toggleEquip action handles all three item types (it flips
  system.equipped on the item).

## v2.30.0 — Starting Blessings entitlement fixed (flat 2, not scaled)

- Fixed the starting-Blessings bug: a newly created character with high Faith
  was granted too many Blessings (e.g. Faith 12 gave 4). The v2.22.0 change
  added a Faith >= 5 guard but left the old floor(Faith/5)*2 scaling in
  place, so it still scaled above Faith 10.
- Corrected to the actual rules: at creation (p.60) a character gains a FLAT
  two (2) Blessings if max Faith is 5+, and zero at 4 or below - never more
  than 2 regardless of how high Faith is. Faith 12 at creation now grants 2.
- Level-up (p.62) now grants 2 new Blessings for each increment of five (5)
  max Faith actually crossed by that level's Faith gain (computed from
  old vs new Faith max), rather than referencing a static "should have"
  total. Crossing one increment = 2; crossing two at once = 4; no crossing
  = 0. The level-up chat note reports this accurately.
- Added a blessingsGranted creation flag: before starting Blessings are
  rolled the sheet targets the flat 2; afterwards it shows the lifetime
  figure (2 per 5 Faith) as the running reference. The Roll Blessings button
  and header read from this. Tooltip corrected to describe the real rule.

## v2.31.0 — Step 6 Talents & Crafts from the class list

- **ClassData** gains talentCraftList (the Ch7 per-class Talent/Craft skill
  list). Populated for all 11 relevant classes (Adventurer and Fighter
  excluded - they work differently) with 25 skills each, transcribed from
  the book.
- Added 8 skills the lists reference that weren't in the compendium yet
  (HP: Hearing/Sight/Touch, Cult Knowledge, CS Profiling Tactics,
  Miracles: High, Miracles: Holy Songs, Read/Write addLG). The Skills
  compendium is now 94 items; every class-list skill resolves.
- **Choose Talents & Crafts** button on the Skills tab (Step 6): pick 5
  Talents (+2 PF) and 3 Crafts (+1 PF) from the class's list in one dialog,
  with duplicate selections prevented (client-side, plus server-side
  validation of exactly 5 + 3 unique). Skills are granted into the correct
  section at the correct PF, matched against the compendium so links carry
  across. Locks when done (creation.talentsCraftsChosen); GM unlock link
  provided.
- This completes the earlier gap where Talent/Craft picks drew from the
  whole compendium rather than the class list.

## v2.32.0 — Adventurer/Fighter skill selection (all at +2)

- **ClassData** gains basicSkillList - the Adventurer/Fighter combined skill
  pool (p.58). Populated: Adventurer 34 skills, Fighter 32 skills.
- These two classes work differently: instead of Gifts at +3 and Talents/
  Crafts at +2/+1, they pick 7 Gifts + 5 Talents + 3 Crafts from ONE pool,
  all at +2 PF. A dedicated "Choose Skills" banner and picker on the Skills
  tab handles this - 15 dropdowns (7/5/3) from the pool, duplicates
  prevented, granted into the right sections all at +2. Locks via the same
  creation.talentsCraftsChosen flag (also sets giftsGranted).
- Cleared the old grantedGifts data on Adventurer/Fighter so only the
  combined picker shows for them (not the standard +3 Gift-grant banner).
- All 48 unique skills across both pools resolve against the compendium.
- Completes Step 6 for all 13 classes: 11 use the standard Gift-grant +
  Talent/Craft picker, Adventurer and Fighter use the all-at-+2 pool picker.

## v2.33.0 — Skill-picker dialogs scroll when tall

- Fixed the Adventurer/Fighter "Choose Skills" dialog (and the standard
  Talents & Crafts dialog) overflowing the viewport: with 15 (or 8)
  dropdowns the box could render taller than the screen, aligned to the
  bottom, hiding the first Gifts with no way to scroll. The dropdown area is
  now wrapped in a scrollable container capped at 60vh, so all slots are
  reachable regardless of screen size.

## v2.34.0 — Rule of Halves validation on Combat Abilities & Weapon Skills

- Added a shared ruleOfHalvesCheck helper implementing the Combat Handbook
  rule precisely: no single action's Bonus may be more than twice the next
  highest. Verified against the book's examples (+2 DEF/+1 ADV valid since
  2=2x1; +3 DEF alone invalid; +4 ATT/+2 CRI valid since 4=2x2; +3 ATT/+1 CRI
  invalid).
- **Weapon Skills** now get this check across their ATT/CRI/SPC split (this
  was the requested addition) - a warning appears on the WS block when the
  split breaks the rule, alongside the existing ATT>=CRI/SPC and budget
  checks.
- **Combat Abilities** RoH corrected: previously it only checked above a +7
  total and used a min-based test; it now applies the handbook's twice-the-
  next-highest rule to the ADV/DOD/DEF/DAM split at any level, matching the
  quoted "+3 to DEF, +0 to others is not allowed" example.
- Warnings are soft (non-blocking), consistent with the other creation-step
  validations, and render in the existing warning slots - no sheet layout
  change.

## v2.35.0 — Rule of Halves now applies down the whole chain

- Corrected the Combat Abilities / Weapon Skills Rule of Halves: it now
  checks EVERY bonus against the next lowest (down the sorted chain), not
  just the top two. So [4,2,1] passes but [4,2,0]-style over-concentration
  and any mid-chain break is caught.
- Unassigned (zero) actions are ignored, so partial distributions like +1 to
  three actions, or a single lone bonus, don't wrongly flag - the rule
  governs how ASSIGNED points relate to each other.
- No "+7 before it applies" caveat here (that's a general-Skill rule, not a
  Combat Ability/Weapon Skill one), so it applies from the first point.
- Verified across 11 distributions including perfect halving [8,4,2,1]
  (valid), [3,1] (violation), even spreads, and lone bonuses.

## v2.36.0 — Rule of Halves uses integer halving down the chain

- Final correct Rule of Halves for Combat Abilities and Weapon Skills: walk
  every adjacent pair down the sorted Bonuses; each must be at least HALF of
  the one above it, ROUNDED DOWN. So 0 legally counts as half of 1
  (floor(1/2)=0) but not as half of 2+ (floor(2/2)=1).
- This is the only rule consistent with all three handbook examples AND the
  mid-chain requirement: [2,1,0,0] and [1,1,1,0] are valid; [3,0,0,0] fails
  (0 < floor(3/2)=1); [4,2,0] fails (0 < floor(2/2)=1); [8,4,2,1] passes.
  Zeros are kept in the chain (they count), resolving the earlier
  zero-handling back-and-forth.
- Warning wording updated to state the needed minimum for the next-lowest
  Bonus rather than a "twice" ceiling.

## v2.37.0 — Rule of Halves rounds UP (at least half), with 1-over-0 exception

- Corrected the rounding: each Bonus down the chain must be at least half of
  the one above it ROUNDED UP - next >= ceil(higher/2) - not rounded down.
  So [5,2,...] now correctly FAILS (needs [5,3,...]); [7,3,...] fails (needs
  +4). The sole exception is the 1->0 step: a +1 may sit above a +0.
- All prior cases still hold: [2,1,0,0] and [1,1,1,0] valid (via the 1->0
  exception on their last step), [3,0,0,0] / [4,2,0] / lone +2 invalid,
  perfect halving [8,4,2,1] valid. Verified across 16 distributions.
- Warning wording notes the next-lowest must be at least half (rounded up).
