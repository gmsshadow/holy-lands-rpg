export class HolyLandsActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["holy-lands-rpg", "sheet", "actor"],
      width: 720,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }]
    });
  }

  /** @override */
  get template() {
    return `systems/holy-lands-rpg/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /** @override */
  async getData() {
    const context = super.getData();
    const actorData = this.actor.toObject(false);

    context.system = actorData.system;
    context.flags = actorData.flags;

    // Add roll data for convenience
    context.rollData = this.actor.getRollData();

    // Prepare character data
    if (actorData.type === 'character') {
      this._prepareCharacterData(context);
    }

    // Prepare NPC data
    if (actorData.type === 'npc') {
      this._prepareNPCData(context);
    }

    // Prepare items
    this._prepareItems(context);

    return context;
  }

  /**
   * Organize and classify Character data
   */
  _prepareCharacterData(context) {
    // Character classes
    context.classes = {
      adventurer: "Adventurer",
      bard: "Bard",
      cleric: "Cleric",
      devilHunter: "Devil Hunter",
      fighter: "Fighter",
      jester: "Jester",
      knight: "Knight",
      saint: "Saint",
      saisier: "Saisier",
      scout: "Scout",
      spy: "Spy",
      voyager: "Voyager",
      warrior: "Warrior"
    };

    // Statures
    context.statures = {
      weeFolk: "WeeFolk",
      dwarfolk: "Dwarfolk",
      commonFolk: "CommonFolk",
      giantFolk: "GiantFolk"
    };
  }

  /**
   * Organize and classify NPC data
   */
  _prepareNPCData(context) {
    // Add specific NPC data if needed
  }

  /**
   * Organize and classify Items for the sheet
   */
  _prepareItems(context) {
    const weapons = [];
    const armor = [];
    const equipment = [];
    const miracles = [];
    const blessings = [];
    const skills = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      
      if (i.type === 'weapon') {
        weapons.push(i);
      } else if (i.type === 'armor') {
        armor.push(i);
      } else if (i.type === 'equipment') {
        equipment.push(i);
      } else if (i.type === 'miracle') {
        miracles.push(i);
      } else if (i.type === 'blessing') {
        blessings.push(i);
      } else if (i.type === 'skill') {
        skills.push(i);
      }
    }

    context.weapons = weapons;
    context.armor = armor;
    context.equipment = equipment;
    context.miracles = miracles;
    context.blessings = blessings;
    context.skills = skills;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Rollable abilities
    html.find('.rollable').click(this._onRoll.bind(this));

    // Attribute rolls
    html.find('.attribute-roll').click(this._onAttributeRoll.bind(this));

    // Ability rolls
    html.find('.ability-roll').click(this._onAbilityRoll.bind(this));

    // Skill rolls
    html.find('.skill-roll').click(this._onSkillRoll.bind(this));

    // Save rolls
    html.find('.save-roll').click(this._onSaveRoll.bind(this));

    // Weapon/Attack rolls
    html.find('.attack-roll').click(this._onAttackRoll.bind(this));
    html.find('.damage-roll').click(this._onDamageRoll.bind(this));

    // Miracle/Blessing activation
    html.find('.miracle-cast').click(this._onMiracleCast.bind(this));
    html.find('.blessing-use').click(this._onBlessingUse.bind(this));

    // Drag events for macros
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const data = duplicate(header.dataset);
    const name = `New ${type.capitalize()}`;
    const itemData = {
      name: name,
      type: type,
      system: data
    };
    delete itemData.system["type"];

    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle clickable rolls
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset.rollType) {
      if (dataset.rollType === 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    if (dataset.roll) {
      let label = dataset.label ? `${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

  /**
   * Handle attribute rolls (d12, roll under)
   */
  async _onAttributeRoll(event) {
    event.preventDefault();
    const attrKey = event.currentTarget.dataset.attribute;
    return this.actor.rollAttribute(attrKey);
  }

  /**
   * Handle ability rolls (d20 + bonus)
   */
  async _onAbilityRoll(event) {
    event.preventDefault();
    const abilityKey = event.currentTarget.dataset.ability;
    
    // Ask for Difficulty Factor
    const df = await this._getDifficultyFactor();
    if (df === null) return;
    
    return this.actor.rollAbility(abilityKey, df);
  }

  /**
   * Handle skill rolls (d20 + bonus)
   */
  async _onSkillRoll(event) {
    event.preventDefault();
    const skillKey = event.currentTarget.dataset.skill;
    
    // Ask for Difficulty Factor
    const df = await this._getDifficultyFactor();
    if (df === null) return;
    
    return this.actor.rollSkill(skillKey, df);
  }

  /**
   * Handle saving throw rolls
   */
  async _onSaveRoll(event) {
    event.preventDefault();
    const saveKey = event.currentTarget.dataset.save;
    
    // Ask for Difficulty Factor
    const df = await this._getDifficultyFactor();
    if (df === null) return;
    
    return this.actor.rollSave(saveKey, df);
  }

  /**
   * Handle attack rolls
   */
  async _onAttackRoll(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const weapon = this.actor.items.get(itemId);
    
    return this.actor.rollAttack(weapon);
  }

  /**
   * Handle damage rolls
   */
  async _onDamageRoll(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const weapon = this.actor.items.get(itemId);
    
    // Ask if critical
    const isCritical = event.shiftKey || false;
    
    return this.actor.rollDamage(weapon, isCritical);
  }

  /**
   * Handle casting miracles
   */
  async _onMiracleCast(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const miracle = this.actor.items.get(itemId);
    
    if (miracle) {
      return miracle.castMiracle();
    }
  }

  /**
   * Handle using blessings
   */
  async _onBlessingUse(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const blessing = this.actor.items.get(itemId);
    
    if (blessing) {
      return blessing.useBlessing();
    }
  }

  /**
   * Get difficulty factor from user
   */
  async _getDifficultyFactor() {
    return new Promise((resolve) => {
      new Dialog({
        title: "Difficulty Factor",
        content: `
          <form>
            <div class="form-group">
              <label>Enter Difficulty Factor (DF):</label>
              <input type="number" name="df" value="10" autofocus/>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            label: "Roll",
            callback: (html) => {
              const df = parseInt(html.find('[name="df"]').val());
              resolve(df);
            }
          },
          cancel: {
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "roll"
      }).render(true);
    });
  }
}
