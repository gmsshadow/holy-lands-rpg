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
