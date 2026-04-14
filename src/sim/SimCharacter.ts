import { IPoint2D } from "./Geometry";
import { random, randomBetween } from "./Rng";
import { Sim } from "./Sim";

// ─── Name pools ───────────────────────────────────────────────────────────────

const FIRST_NAMES_MALE: string[] = [
    'Adam', 'Ben', 'Carlos', 'David', 'Ethan',
    'Felix', 'Gabriel', 'Hugo', 'Ivan', 'James',
    'Kevin', 'Liam', 'Marco', 'Nathan', 'Oliver',
    'Paul', 'Ryan', 'Sam', 'Tom', 'Vincent',
    'William', 'Xavier', 'Yuri', 'Zachary',
    'Alex', 'Brian', 'Chris', 'Daniel', 'Eric',
    'Frank', 'George', 'Harry', 'Isaac', 'Jack',
    'Kyle', 'Leo', 'Matt', 'Nick', 'Oscar',
    'Peter', 'Quentin', 'Richard', 'Steve', 'Tony',
];

const FIRST_NAMES_FEMALE: string[] = [
    'Alice', 'Bella', 'Clara', 'Diana', 'Emma',
    'Fiona', 'Grace', 'Hannah', 'Iris', 'Julia',
    'Karen', 'Laura', 'Mia', 'Nina', 'Olivia',
    'Paula', 'Rachel', 'Sara', 'Tina', 'Yasmine',
    'Zoe', 'Amy', 'Brenda', 'Catherine', 'Deborah',
    'Ella', 'Frances', 'Gloria', 'Helen', 'Isabella',
    'Jessica', 'Katherine', 'Linda', 'Monica', 'Natalie',
    'Patricia', 'Queen', 'Rebecca', 'Sophie', 'Theresa',
];

const LAST_NAMES: string[] = [
    'Anderson', 'Brown', 'Clark', 'Davis', 'Evans',
    'Foster', 'Garcia', 'Harris', 'Johnson', 'King',
    'Lewis', 'Miller', 'Nelson', 'Owen', 'Parker',
    'Rivera', 'Smith', 'Taylor', 'Walker', 'Wilson',
    'Young', 'Zimmerman', 'Adams', 'Baker', 'Campbell',
    'Collins', 'Cook', 'Edwards', 'Flores', 'Gonzalez',
    'Green', 'Hall', 'Hill', 'Jackson', 'Kelly',
    'Lee', 'Mitchell', 'Moore', 'Perez', 'Roberts',
    'Scott', 'Turner', 'White', 'Wright',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female';

export type AgeGroup = 'child' | 'adult' | 'senior';

export type JobType =
    | 'unemployed'
    | 'worker'      // industrial building
    | 'office'      // commercial building
    | 'manager'     // office, higher income
    | 'student'
    | 'retired';

export type Activity =
    | 'sleeping'
    | 'home'
    | 'commuting_to_work'
    | 'working'
    | 'commuting_home'
    | 'shopping'
    | 'leisure';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface INeeds {
    /** 0 = full, 100 = starving */
    hunger: number;
    /** 0 = exhausted, 100 = fully rested */
    energy: number;
    /** 0 = bored, 100 = entertained */
    fun: number;
    /** 0 = lonely, 100 = very social */
    social: number;
}

export interface IJob {
    type: JobType;
    /** Monthly income in the city's currency */
    income: number;
    /** Hour of day work starts (0–23) */
    startHour: number;
    /** Hour of day work ends (0–23) */
    endHour: number;
    /** Tile where the character works (null if no fixed workplace yet) */
    workplaceTile: IPoint2D | null;
}

export interface ICharacterChanged {
    id: number;
    activity?: Activity;
    needs?: Partial<INeeds>;
    location?: IPoint2D | null;
}

export interface IHouseholdChanged {
    id: number;
    homeTile?: IPoint2D | null;
    memberIds?: number[];
    carCount?: number;
}

// ─── SimHousehold ─────────────────────────────────────────────────────────────

export class SimHousehold {
    homeTile: IPoint2D | null = null;
    memberIds: number[] = [];
    /**
     * Number of cars owned by the household (0, 1 or 2).
     * Traffic cars that represent them in the world are managed separately.
     */
    carCount: number = 0;

    constructor(
        readonly characters: SimCharacters,
        readonly id: number,
        readonly lastName: string,
    ) { }

    get members(): SimCharacter[] {
        return this.memberIds
            .map(id => this.characters.getCharacter(id))
            .filter((c): c is SimCharacter => c !== undefined);
    }

    get totalIncome(): number {
        return this.members.reduce((sum, c) => sum + c.job.income, 0);
    }

    addMember(character: SimCharacter): void {
        if (!this.memberIds.includes(character.id)) {
            this.memberIds.push(character.id);
        }
        character.householdId = this.id;
    }

    markChanged(): void {
        this.characters.householdChanged.set(this.id, {
            id: this.id,
            homeTile: this.homeTile,
            memberIds: [...this.memberIds],
            carCount: this.carCount,
        });
    }
}

// ─── SimCharacter ─────────────────────────────────────────────────────────────

export class SimCharacter {
    readonly id: number;
    readonly gender: Gender;
    firstName: string;
    lastName: string;
    age: number;

    householdId: number = -1;
    spouseId: number | null = null;
    parentIds: number[] = [];
    childIds: number[] = [];

    job: IJob;
    needs: INeeds;
    activity: Activity = 'home';
    /** Current world-space position; null when indoors */
    location: IPoint2D | null = null;

    constructor(
        readonly characters: SimCharacters,
        id: number,
        gender: Gender,
    ) {
        this.id = id;
        this.gender = gender;
        this.firstName = gender === 'male'
            ? random(FIRST_NAMES_MALE)
            : random(FIRST_NAMES_FEMALE);
        this.lastName = random(LAST_NAMES);
        this.age = randomBetween(18, 65);
        this.job = SimCharacter.#randomAdultJob();
        this.needs = {
            hunger: randomBetween(10, 50),
            energy: randomBetween(40, 100),
            fun: randomBetween(20, 80),
            social: randomBetween(20, 80),
        };
    }

    get ageGroup(): AgeGroup {
        if (this.age < 18) return 'child';
        if (this.age < 65) return 'adult';
        return 'senior';
    }

    get fullName(): string {
        return `${this.firstName} ${this.lastName}`;
    }

    // ── Private factories ──────────────────────────────────────────────────────

    static #randomAdultJob(): IJob {
        const weights: JobType[] = [
            'worker', 'worker', 'worker',
            'office', 'office',
            'manager',
            'unemployed',
        ];
        const type = random(weights);
        return {
            type,
            income: SimCharacter.#incomeFor(type),
            startHour: type === 'worker' ? 7 : 9,
            endHour: type === 'worker' ? 16 : 18,
            workplaceTile: null,
        };
    }

    static studentJob(): IJob {
        return { type: 'student', income: 0, startHour: 8, endHour: 15, workplaceTile: null };
    }

    static retiredJob(): IJob {
        return {
            type: 'retired',
            income: randomBetween(800, 1800),
            startHour: 0,
            endHour: 0,
            workplaceTile: null,
        };
    }

    static #incomeFor(type: JobType): number {
        switch (type) {
            case 'manager': return randomBetween(3000, 6000);
            case 'office': return randomBetween(1800, 3500);
            case 'worker': return randomBetween(1200, 2500);
            case 'unemployed': return randomBetween(400, 900);
            case 'retired': return randomBetween(800, 1800);
            case 'student': return 0;
        }
    }

    // ── Simulation ─────────────────────────────────────────────────────────────

    /** Advance by `dt` (fraction of a day) at `hourOfDay` (0–23). */
    tick(dt: number, hourOfDay: number): void {
        this.#updateNeeds(dt);
        this.#updateActivity(hourOfDay);
    }

    #updateNeeds(dt: number): void {
        const sleeping = this.activity === 'sleeping';
        const working = this.activity === 'working';
        const leisuring = this.activity === 'leisure' || this.activity === 'shopping';

        this.needs.hunger = clamp(this.needs.hunger + dt * 8, 0, 100);
        this.needs.energy = clamp(this.needs.energy + (sleeping ? 30 : -5) * dt, 0, 100);
        this.needs.fun = clamp(this.needs.fun + (leisuring ? 15 : -3) * dt, 0, 100);
        this.needs.social = clamp(this.needs.social + (working ? 5 : -2) * dt, 0, 100);

        this.markChanged({ needs: { ...this.needs } });
    }

    #updateActivity(hour: number): void {
        const { type, startHour, endHour } = this.job;
        const hasSchedule = type !== 'unemployed' && type !== 'retired';

        // Night — everyone sleeps
        if (hour >= 22 || hour < 6) {
            this.#transition('sleeping');
            return;
        }

        if (hasSchedule) {
            const commuteStart = Math.max(6, startHour - 1);

            if (hour >= commuteStart && hour < startHour) {
                this.#transition('commuting_to_work');
            } else if (hour >= startHour && hour < endHour) {
                this.#transition('working');
            } else if (hour >= endHour && hour < endHour + 1) {
                this.#transition('commuting_home');
            } else {
                this.#chooseFreeTime();
            }
        } else {
            this.#chooseFreeTime();
        }
    }

    #chooseFreeTime(): void {
        // Just returned home from somewhere else
        if (
            this.activity === 'sleeping' ||
            this.activity === 'working' ||
            this.activity === 'commuting_home'
        ) {
            this.#transition('home');
            return;
        }
        // Low fun → go out
        if (this.needs.fun < 25 && this.activity === 'home') {
            this.#transition('leisure');
            return;
        }
        // Fun restored → come back
        if (this.needs.fun > 75 && this.activity === 'leisure') {
            this.#transition('home');
        }
    }

    #transition(activity: Activity): void {
        if (this.activity === activity) return;
        this.activity = activity;
        this.markChanged({ activity });
    }

    markChanged(changes: Partial<Omit<ICharacterChanged, 'id'>> = {}): void {
        const existing = this.characters.characterChanged.get(this.id) ?? { id: this.id };
        this.characters.characterChanged.set(this.id, { ...existing, ...changes, id: this.id });
    }
}

// ─── SimCharacters ────────────────────────────────────────────────────────────

export class SimCharacters {
    readonly characters: SimCharacter[] = [];
    readonly households: SimHousehold[] = [];

    characterChanged = new Map<number, ICharacterChanged>();
    householdChanged = new Map<number, IHouseholdChanged>();

    /** Fraction of the current day elapsed [0, 1). Starts at 6 AM. */
    dayProgress: number = 6 / 24;

    /** How many game-days pass per real second. Default: 1 day per minute. */
    daySpeed: number = 1 / 60;

    constructor(readonly sim: Sim) { }

    // ── Accessors ──────────────────────────────────────────────────────────────

    get hourOfDay(): number {
        return Math.floor(this.dayProgress * 24);
    }

    getCharacter(id: number): SimCharacter | undefined {
        return this.characters[id];
    }

    getHousehold(id: number): SimHousehold | undefined {
        return this.households[id];
    }

    // ── Factories ──────────────────────────────────────────────────────────────

    createCharacter(gender?: Gender): SimCharacter {
        const g = gender ?? (random(2) === 0 ? 'male' : 'female');
        const c = new SimCharacter(this, this.characters.length, g);
        this.characters.push(c);
        return c;
    }

    createHousehold(lastName: string): SimHousehold {
        const h = new SimHousehold(this, this.households.length, lastName);
        this.households.push(h);
        return h;
    }

    /**
     * Create a typical family household:
     * - An adult couple (married)
     * - 0–3 children
     * - 1 or 2 cars depending on income
     */
    createFamily(): SimHousehold {
        const lastName = random(LAST_NAMES);
        const household = this.createHousehold(lastName);

        // ── Adults ────────────────────────────────────────────────────────────
        const adult1 = this.createCharacter('male');
        const adult2 = this.createCharacter('female');

        adult1.lastName = lastName;
        adult2.lastName = lastName;
        adult1.age = randomBetween(25, 55);
        adult2.age = randomBetween(25, 55);
        adult1.spouseId = adult2.id;
        adult2.spouseId = adult1.id;

        if (adult1.age >= 65) adult1.job = SimCharacter.retiredJob();
        if (adult2.age >= 65) adult2.job = SimCharacter.retiredJob();

        household.addMember(adult1);
        household.addMember(adult2);

        // ── Children ──────────────────────────────────────────────────────────
        const childCount = random(4); // 0, 1, 2 or 3
        for (let i = 0; i < childCount; i++) {
            const child = this.createCharacter();
            child.lastName = lastName;
            child.age = randomBetween(3, 18);
            child.job = SimCharacter.studentJob();
            child.parentIds = [adult1.id, adult2.id];
            adult1.childIds.push(child.id);
            adult2.childIds.push(child.id);
            household.addMember(child);
        }

        // ── Cars ──────────────────────────────────────────────────────────────
        // Wealthier households have 2 cars; lower-income households have 1.
        household.carCount = household.totalIncome > 3000 ? 2 : 1;

        household.markChanged();
        return household;
    }

    /** Populate the simulation with `familyCount` random family households. */
    feedRandom(familyCount: number): void {
        for (let i = 0; i < familyCount; i++) {
            this.createFamily();
        }
    }

    // ── Simulation tick ────────────────────────────────────────────────────────

    /** Call every frame. `deltaSeconds` is real elapsed time in seconds. */
    update(deltaSeconds: number): void {
        this.dayProgress = (this.dayProgress + deltaSeconds * this.daySpeed) % 1;
        const dt = deltaSeconds * this.daySpeed;
        const hour = this.hourOfDay;
        for (const character of this.characters) {
            character.tick(dt, hour);
        }
    }

    getCharacterChanged(): ICharacterChanged[] {
        return Array.from(this.characterChanged.values());
    }

    getHouseholdChanged(): IHouseholdChanged[] {
        return Array.from(this.householdChanged.values());
    }

    clearChanged(): void {
        this.characterChanged.clear();
        this.householdChanged.clear();
    }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
