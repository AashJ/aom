export interface UnitTypeStats {
  readonly id: number;
  readonly key: string;
  readonly label: string;
  readonly culture: number;
  readonly classes: number;
  // Hero behavior is authored content, never inferred from a display name or id.
  // Only hero definitions carry this profile; catalog validation keeps the
  // profile and UNIT_CLASS_HERO membership in lockstep.
  readonly hero?: HeroTraits;
  readonly maxHp: number;
  readonly lineOfSight: number;
  readonly movementSpeed: number;
  // Omitted only by legacy land definitions. Gate E units must author their
  // movement domain explicitly so navigation never infers water behavior from
  // presentation, names, or combat classes.
  readonly movementDomain?: MovementDomain;
  // Resource nodes may restrict which navigation domain can harvest them.
  // Fish use this to reject land workers without coupling gather logic to a type id.
  readonly resourceGathererDomain?: MovementDomain;
  readonly workRange?: number;
  readonly gather?: GatherTraits;
  // Colossus-style repair consumes compatible world resources directly. It is
  // an explicit order, not passive regeneration or worker cargo gathering.
  readonly resourceEat?: ResourceEatTraits;
  // Egyptian priests and Pharaohs expose explicit support actions. These are
  // orders with their own target legality and rates, not negative-damage attacks.
  readonly heal?: HealTraits;
  readonly empower?: EmpowerTraits;
  readonly convert?: ConvertTraits;
  // Son of Osiris is the launch-ruleset exception: ordinary heal actions cannot
  // target him even though he can heal other units.
  readonly healable?: boolean;
  // Egyptian heroes are shadow-upgraded by the current Age. The source arrays
  // are absolute per-Age values/multipliers so Archaic weakening and uneven
  // range/vision jumps remain data, not unit-id branches.
  readonly ageProgression?: AgeProgressionTraits;
  // Non-worker builders such as the Egyptian Fishing Ship author their own
  // reach and rate relative to the culture's ordinary builder for that site.
  readonly construction?: ConstructionTraits;
  readonly armor: ArmorProfile;
  // Exactly one primary attack shape or none. The discriminant is authoritative:
  // combat never guesses delivery behavior from classes, range, or presentation.
  readonly attack: Attack | null;
  // Siege Tower switches to this ram action only against buildings. Keeping it
  // separate preserves the unit-only projectile volley and its own cadence.
  readonly buildingAttack?: MeleeAttack;
  // Charged attacks are a second, independently recharging action. They remain
  // separate from the primary attack so neither combat nor presentation has to
  // infer a special cycle from a unit id, animation name, or damage spike.
  readonly specialAttack?: SpecialAttack;
  // Enter-capable units own the complete containment contract. Valid targets
  // are OR alternatives, matching Classic proto action target lists.
  readonly garrison?: GarrisonTraits;
  // Trade units own their route economics. Town Centers and Markets expose a
  // role instead; command handling never switches on culture-specific type ids.
  readonly trade?: TradeTraits;
  readonly tradeSite?: "market" | "town-center";
  // Some Classic buildings create units when combat destroys them. The source
  // building owns the rule so death processing never switches on a unit key.
  readonly deathSpawn?: DamageDeathSpawn;
  // Some Classic units release an immediate area attack when they die. This is
  // authored independently from charged attacks because it has no target,
  // cooldown, action state, or presentation-controlled impact frame.
  readonly deathAreaAttack?: DeathAreaAttack;
  // Phoenix-style rebirth is a direct unit replacement at the lethal position.
  // The placement rule is authored because Classic suppresses the Egg when the
  // flying victim is not directly above suitable land.
  readonly deathReplacement?: DeathReplacement;
  readonly isStatic: boolean;
  readonly resource: number;
  // Melee reach measures to the target's surface, not center.
  readonly bodyRadius: number;
  // NonCollideable removes unit-to-unit obstruction without disabling the
  // independently authored projectile collision flag.
  readonly collidesWithUnits?: boolean;
  // Mirrors the authored CollidesWithProjectiles flag. Body radius alone does
  // not make resources or other explicitly excluded entities projectile-solid.
  readonly collidesWithProjectiles: boolean;
  // Tiles per side, square; 0 = no footprint.
  readonly footprint: number;
  // Docks straddle the coast: every occupied tile must be valid land or water,
  // and the footprint must touch both domains. Omitted buildings require land.
  readonly placementTerrain?: "shoreline";
  readonly costFood: number;
  readonly costWood: number;
  readonly costGold: number;
  readonly costFavor: number;
  readonly buildTicks: number;
  // Persistent Classic regeneration is an always-on content rate. Health itself
  // carries the fractional authoritative remainder, so no parallel timer or
  // unit-specific action state is required.
  readonly regenerationPerSecond?: number;
  // Temporary units expire after this many completed simulation ticks. Omitted
  // means the unit has no fixed lifetime.
  readonly lifespanTicks?: number;
  readonly populationCost: number;
  readonly popBonus: number;
  // Distance along the building's forward (-Z) axis where trained units emerge.
  readonly trainExitOffset: number;
  // A Phoenix Egg is a zero-footprint building-like producer which can train
  // exactly once, then disappears. It substitutes for the ordinary Temple
  // prerequisite without changing the trained unit's age, god, cost, or time.
  readonly trainingSite?: TrainingSiteTraits;
  readonly isDropsite: boolean;
  // Water gatherers must not select an unreachable land dropsite merely because
  // it is geometrically closer. Omitted dropsites serve land gatherers.
  readonly resourceDropsiteDomain?: MovementDomain;
  readonly requiredAge: number;
  readonly requiredGod: number;
  readonly prerequisiteBuildings: readonly number[];
  readonly trainedAt: readonly TypeCommandRelationship[];
  readonly builtBy: readonly TypeCommandRelationship[];
}

export interface GarrisonTraits {
  readonly capacity: number;
  readonly enterRange: number;
  readonly validOccupants: readonly DamageBonusTarget[];
  readonly attackMultiplierPerOccupant: number;
  readonly speedMultiplierPerOccupant?: number;
  readonly ejectOnDeath: boolean;
}

export interface TradeTraits {
  readonly capacity: number;
  readonly interactionRange: number;
  readonly townCenterWorkRate: number;
  readonly townCenterMinimumRate: number;
  readonly incomeMultiplier: number;
}

export interface GatherTraits {
  readonly capacity: number;
  readonly ratePerSecond: number;
}

export interface ResourceEatTraits {
  readonly range: number;
  readonly resourceTypes: readonly number[];
  readonly consumePerSecond: number;
  readonly healPerSecond: number;
}

export interface HealTraits {
  readonly range: number;
  readonly hitPointsPerSecond: number;
  readonly activeTargetMultiplier: number;
}

export interface EmpowerTraits {
  readonly range: number;
  readonly buildWorkMultiplier: number;
  readonly gatherYieldMultiplier: number;
  readonly trainWorkMultiplier: number;
  readonly attackIntervalMultiplier: number;
  readonly requiredMajorGod?: number;
}

export interface ConvertTraits {
  readonly range: number;
  readonly baseTicks: number;
  readonly targetTicks?: readonly { readonly unitType: number; readonly ticks: number }[];
  readonly requiredMajorGod?: number;
}

export interface AgeProgressionTraits {
  readonly maxHpMultipliers: readonly [number, number, number, number];
  readonly lineOfSight: readonly [number, number, number, number];
  readonly attackRanges: readonly [number, number, number, number];
  readonly attackDamageMultipliers: readonly [number, number, number, number];
}

export interface ConstructionTraits {
  readonly range: number;
  readonly ratePerSecond: number;
  readonly baselineRatePerSecond: number;
}

export interface DamageDeathSpawn {
  readonly trigger: "destroyed-by-damage";
  readonly requiredGod: number;
  readonly unitType: number;
  readonly count: number;
  readonly liveLimit: number;
}

export interface DeathAreaAttack {
  readonly damage: DamageProfile;
  readonly radius: number;
  readonly falloff: "constant";
  readonly damageRelations: number;
  readonly bonuses: readonly DamageBonus[];
}

export interface DeathReplacement {
  readonly trigger: "death";
  readonly unitType: number;
  readonly placementDomain: MovementDomain;
  readonly requireNavigableOrigin: boolean;
}

export interface TrainingSiteTraits {
  readonly consumeOnCompletion: boolean;
  readonly substitutesForPrerequisites: boolean;
}

export const MOVEMENT_DOMAIN_LAND = 0;
export const MOVEMENT_DOMAIN_WATER = 1;
export const MOVEMENT_DOMAIN_AMPHIBIOUS = 2;
export const MOVEMENT_DOMAIN_AIR = 3;
export type MovementDomain =
  | typeof MOVEMENT_DOMAIN_LAND
  | typeof MOVEMENT_DOMAIN_WATER
  | typeof MOVEMENT_DOMAIN_AMPHIBIOUS
  | typeof MOVEMENT_DOMAIN_AIR;

export interface HeroTraits {
  // Greek heroes use one live-or-queued copy of each identity per player.
  readonly trainLimit?: number;
  readonly relicCapacity: number;
  readonly relicPickupRange: number;
  readonly relicDropOffRange: number;
}

export type DamageProfile = readonly [hack: number, pierce: number, crush: number];
export type ArmorProfile = readonly [hack: number, pierce: number, crush: number];

interface AttackBase {
  readonly damage: DamageProfile;
  readonly range: number;
  readonly aggroRange: number;
  readonly cooldownTicks: number;
  readonly bonuses: readonly DamageBonus[];
  // Classic's Kataskopos accepts explicit attack orders but does not acquire
  // nearby enemies on its own. Omitted means the normal auto-acquire behavior.
  readonly autoAcquire?: boolean;
  // Classic ranged siege gives buildings priority during automatic target
  // selection. Explicit orders remain authoritative. Omitted keeps ordinary
  // nearest-target acquisition.
  readonly autoAcquireBuildings?: boolean;
}

export interface MeleeAttack extends AttackBase {
  readonly kind: "melee";
  // Flying hand attackers can explicitly reach other flying units. Ordinary
  // ground melee retains Classic's ground-only target restriction.
  readonly canTargetAir?: boolean;
  // Some HandAttack actions land at range and resolve around the target rather
  // than against only that entity. Components preserve Classic's per-damage-
  // type relation flags (including the launch Phoenix's friendly-fire crush).
  readonly impactArea?: MeleeImpactArea;
  // Classic can select unequal source clips for one attack action. Damage is
  // authored as a per-cooldown rate, so each selected clip scales the landed
  // hit by actionTicks / cooldownTicks. The active variant is authoritative
  // simulation state; presentation never re-selects it independently.
  readonly cycleVariants?: readonly [MeleeAttackCycle, ...MeleeAttackCycle[]];
  // Classic's Hydra family gains one bounded damage step per credited kill and
  // selects its source animation tier after each fixed number of kills.
  readonly killScaling?: KillScalingMeleeAttack;
}

export interface MeleeImpactArea {
  readonly radius: number;
  readonly falloff: "constant" | "linear";
  readonly components: readonly [MeleeImpactAreaComponent, ...MeleeImpactAreaComponent[]];
}

export interface MeleeImpactAreaComponent {
  readonly damage: DamageProfile;
  readonly damageRelations: number;
}

export interface KillScalingMeleeAttack {
  readonly damageMultiplierPerKill: number;
  readonly maxKills: number;
  readonly killsPerVariant: number;
}

export interface MeleeAttackCycle {
  readonly actionTicks: number;
  readonly impactDelayTicks: number;
}

export interface ProjectileFlight {
  // Stable simulation/presentation identity. Projectile kinds are append-only.
  readonly type: number;
  readonly speed: number;
  readonly lifespanTicks: number;
  readonly collisionRadius: number;
}

export interface ProjectileGuidance {
  // Classic proto accuracy fields. Keep the source names visible so generated
  // unit definitions can be checked directly against hashed reference data.
  readonly accuracy: number;
  readonly accuracyReductionFactor: number;
  readonly aimBonus: number;
  readonly spreadFactor: number;
  readonly maxSpread: number;
  readonly trackRating: number;
  readonly unintentionalDamageMultiplier: number;
  // Classic VolleyMode releases every projectile in one attack event. Omitted
  // means one projectile, preserving the compact shape for ordinary archers.
  readonly projectileCount?: number;
  // A projectile can resolve its damage as an impact-centered area instead of
  // a single direct hit. Misses that complete their flight still detonate.
  readonly impactArea?: ProjectileImpactArea;
  readonly projectile: ProjectileFlight;
}

export interface ProjectileImpactArea {
  readonly radius: number;
  readonly falloff: "linear";
  readonly damageRelations: number;
}

export interface ProjectileAttack extends AttackBase, ProjectileGuidance {
  readonly kind: "projectile";
  // Classic's dead zone is measured from the attacker center to the target
  // surface. Omitted means the projectile has no minimum range.
  readonly minimumRange?: number;
  // Ticks from attack-cycle start to the animation's release event.
  readonly launchDelayTicks: number;
}

export interface BeamAttack extends AttackBase {
  readonly kind: "beam";
  // LightningAttack/BeamAttack deals its stored damage once at the source tag;
  // unlike ordinary melee/projectile DPS, clip length does not scale the hit.
  readonly impactDelayTicks: number;
  readonly chain?: {
    readonly maxTargets: number;
    readonly radius: number;
    readonly damageMultiplier: number;
  };
}

export type Attack = MeleeAttack | ProjectileAttack | BeamAttack;

interface ChargedSpecialAttackBase {
  readonly damage: DamageProfile;
  readonly range: number;
  readonly bonuses: readonly DamageBonus[];
  readonly rechargeTicks: number;
  // Full wind-up/recovery cycle and the authored impact tag within that cycle.
  readonly actionTicks: number;
  readonly impactDelayTicks: number;
  // Entries are OR alternatives; each class mask inside an entry is conjunctive.
  readonly validTargets: readonly DamageBonusTarget[];
  // Source-authored target-state immunities are checked at acquisition and
  // again at impact. The bitmask is optional for older actions with no state
  // exclusions; zero is the exact default.
  readonly invalidTargetConditions?: number;
}

export interface ChargedMeleeSpecialAttack extends ChargedSpecialAttackBase {
  readonly kind: "charged-melee";
  readonly targetReaction?: TargetReaction;
}

export const AREA_DAMAGE_ENEMIES = 1 << 0;
export const AREA_DAMAGE_NEUTRAL_UNITS = 1 << 1;
export const AREA_DAMAGE_ALLIES = 1 << 2;
export const AREA_DAMAGE_NEUTRAL_BUILDINGS = 1 << 3;

export interface ChargedAreaPulseSpecialAttack extends ChargedSpecialAttackBase {
  readonly kind: "charged-area-pulse";
  // The first proven area action is centered on its attacker and lands once at
  // the authored impact tag. Linear falloff reaches zero at radius.
  readonly radius: number;
  readonly falloff: "linear";
  readonly damageRelations: number;
}

export interface ChargedAreaPoisonSpecialAttack extends ChargedSpecialAttackBase {
  readonly kind: "charged-area-poison";
  // The damage profile is a per-second poison rate. Each eligible unit in the
  // attacker-centered area receives an independent, stackable timed effect.
  readonly radius: number;
  readonly falloff: "linear";
  readonly damageRelations: number;
  readonly poisonDurationTicks: number;
}

export interface ChargedConeThrowSpecialAttack extends ChargedSpecialAttackBase {
  readonly kind: "charged-cone-throw";
  // BuckAttack queries an attacker-centered radius and then keeps units within
  // a forward-facing cone before applying one constant hit and forced action.
  readonly radius: number;
  readonly coneHalfAngleDegrees: number;
  readonly damageRelations: number;
  readonly targetReaction: TargetReaction;
}

export interface ChargedPickupThrowSpecialAttack extends ChargedSpecialAttackBase {
  readonly kind: "charged-pickup-throw";
  // Classic Cyclops commits the terminal pickup before the later Throw tag.
  // Its dedicated BUnitThrowAction keeps the victim inside the combined
  // animation until action completion; it is not a BUnitThrownAction flight.
  readonly pickupDelayTicks: number;
  readonly throwDelayTicks: number;
  readonly radius: number;
  readonly falloff: "constant";
  readonly damageRelations: number;
}

export interface ChargedTerminalSpecialAttack extends ChargedSpecialAttackBase {
  readonly kind: "charged-terminal";
  // Classic petrification is a terminal effect, not armor-resolved damage.
  // The target is marked stone before entering the ordinary deferred death
  // pipeline so presentation can preserve the cause without extending life.
  readonly effect: "petrify-kill";
}

export interface ChargedConvertSpecialAttack extends ChargedSpecialAttackBase {
  readonly kind: "charged-convert";
  // ConvertAttack terminally replaces one eligible target with a temporary
  // unit owned by the attacker. The spawned type is content, not a hard-coded
  // Mummy/Minion pairing in combat.
  readonly spawnUnitType: number;
}

export interface ChargedProjectileSpecialAttack
  extends ChargedSpecialAttackBase, ProjectileGuidance {
  readonly kind: "charged-projectile";
  // Zero is an explicit source-audit marker for Trial rows whose pre-release
  // poison field did not ship. Non-zero poison remains a separate foundation.
  readonly poisonFraction?: 0;
}

interface ChargedJumpSpecialAttackBase extends ChargedSpecialAttackBase {
  readonly kind: "charged-jump";
  // JumpAttack is only selected inside this source-authored range band. Once
  // takeoff completes, the locked landing point no longer follows the target.
  readonly minimumRange: number;
  readonly takeoffTicks: number;
  readonly flightTicks: number;
  readonly landingTicks: number;
  readonly jumpHeight: number;
}

export type ChargedJumpSpecialAttack = ChargedJumpSpecialAttackBase &
  (
    | { readonly delivery: "target" }
    | {
        readonly delivery: "area";
        readonly radius: number;
        readonly falloff: "constant";
        readonly damageRelations: number;
      }
  );

export interface ThrownTargetReaction {
  readonly kind: "thrown";
  // Different source actions call the shared BUnitThrownAction constructor in
  // different synchronized RNG orders. A zero bounce range means that action
  // supplies an exact bounce count and consumes no integer draw.
  readonly randomDrawOrder: readonly ("distance" | "maxVelocity" | "maxHeight" | "bounces")[];
  readonly distanceBase: number;
  readonly distanceRandomRange: number;
  readonly maxVelocityBase: number;
  readonly maxVelocityRandomRange: number;
  readonly maxHeightBase: number;
  readonly maxHeightRandomRange: number;
  readonly bounceBase: number;
  readonly bounceRandomRange: number;
}

// Append future source-proven reaction shapes only when a representative unit
// proves their state, interruption, collision, snapshot, and hash contracts.
export type TargetReaction = ThrownTargetReaction;

// Append future source-proven charged shapes to this union. Do not add nullable
// fields for mechanics that no implemented unit exercises.
export type SpecialAttack =
  | ChargedMeleeSpecialAttack
  | ChargedAreaPulseSpecialAttack
  | ChargedAreaPoisonSpecialAttack
  | ChargedConeThrowSpecialAttack
  | ChargedPickupThrowSpecialAttack
  | ChargedTerminalSpecialAttack
  | ChargedConvertSpecialAttack
  | ChargedProjectileSpecialAttack
  | ChargedJumpSpecialAttack;

export type DamageBonusTarget =
  | {
      readonly kind: "classes";
      readonly classes: number;
      readonly requiredCulture?: number;
      readonly excludedCulture?: number;
      readonly excludedClasses?: number;
    }
  | {
      // Classic sometimes names one proto rather than a logical class. Keep that
      // identity explicit instead of encoding it as the magic class mask zero.
      readonly kind: "unit";
      readonly key: string;
    };

export interface DamageBonus {
  readonly target: DamageBonusTarget;
  readonly multiplier: number;
}

export interface TypeCommandRelationship {
  readonly type: number;
  readonly commandSlot: number;
}

export const CULTURE_SHARED = 0;
export const CULTURE_GREEK = 1;
export const CULTURE_EGYPTIAN = 2;
export const CULTURE_NORSE = 3;

export const UNIT_CLASS_WORKER = 1 << 0;
export const UNIT_CLASS_HUMAN = 1 << 1;
export const UNIT_CLASS_INFANTRY = 1 << 2;
export const UNIT_CLASS_CAVALRY = 1 << 3;
export const UNIT_CLASS_MILITARY = 1 << 4;
export const UNIT_CLASS_MELEE = 1 << 5;
export const UNIT_CLASS_BUILDING = 1 << 6;
export const UNIT_CLASS_RESOURCE = 1 << 7;
export const UNIT_CLASS_TEMPLE = 1 << 8;
export const UNIT_CLASS_SIEGE = 1 << 9;
export const UNIT_CLASS_ARCHER = 1 << 10;
export const UNIT_CLASS_HERO = 1 << 11;
// Mirrors Classic's curated LogicalTypeNonGreekUnit membership. This is not
// derivable from culture: counter-infantry and civilian exceptions exist.
export const UNIT_CLASS_NON_GREEK_UNIT = 1 << 12;
export const UNIT_CLASS_MYTH = 1 << 13;
export const UNIT_CLASS_RELIC = 1 << 14;
export const UNIT_CLASS_SCOUT = 1 << 15;
export const UNIT_CLASS_HUNTABLE = 1 << 16;
// Curated membership for the animals created by Set's god power. It is not
// equivalent to Egyptian culture or the broader Huntable class.
export const UNIT_CLASS_SET_ANIMAL = 1 << 17;
export const UNIT_CLASS_AIR = 1 << 18;
export const UNIT_CLASS_SHIP = 1 << 19;
export const UNIT_CLASS_TRANSPORT_SHIP = 1 << 20;
// Titans are explicitly barred from boat and Roc containment in Classic.
// This identity is curated rather than inferred from footprint or myth status.
export const UNIT_CLASS_TITAN = 1 << 21;
export const UNIT_CLASS_CARAVAN = 1 << 22;

export const UNIT_CONDITION_FROZEN = 1 << 0;
export const UNIT_CONDITION_STONE = 1 << 1;

export const DAMAGE_HACK = 0;
export const DAMAGE_PIERCE = 1;
export const DAMAGE_CRUSH = 2;
export const DAMAGE_CLASS_COUNT = 3;

// Fixed resource ids are shared by costs, carrying, stockpiles, snapshots, and UI.
export const FOOD = 0;
export const WOOD = 1;
export const GOLD = 2;
export const FAVOR = 3;
export const RESOURCE_COUNT = 4;

export const NO_UNIT_TYPE = 0xffff;
export const NO_PREREQUISITE_BUILDINGS: readonly number[] = Object.freeze([]);
export const NO_TYPE_RELATIONSHIPS: readonly TypeCommandRelationship[] = Object.freeze([]);
export const NO_ARMOR: ArmorProfile = Object.freeze([0, 0, 0]);
export const NO_DAMAGE: DamageProfile = Object.freeze([0, 0, 0]);
export const NO_DAMAGE_BONUSES: readonly DamageBonus[] = Object.freeze([]);
