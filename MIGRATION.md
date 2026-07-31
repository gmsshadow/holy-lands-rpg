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
