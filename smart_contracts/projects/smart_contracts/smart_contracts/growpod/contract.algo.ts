import {
  Contract,
  GlobalState,
  LocalState,
  uint64,
  bytes,
  Bytes,
  Uint64,
  assert,
  itxn,
  gtxn,
  Txn,
  Global,
  op,
  Asset,
} from '@algorandfoundation/algorand-typescript'

// ========== CONSTANTS ==========
const BASE_YIELD: uint64 = Uint64(250_000_000) // 0.25g = 250M units (6 decimals)
const WATER_COOLDOWN_MIN: uint64 = Uint64(14_400) // 4 hours minimum
const NUTRIENT_COOLDOWN: uint64 = Uint64(21_600) // 6 hours in seconds
const GROWTH_CYCLE: uint64 = Uint64(864_000) // 10 days in seconds
const CLEANUP_BURN: uint64 = Uint64(500_000_000) // 500 $BUD
const BREED_BURN: uint64 = Uint64(1_000_000_000) // 1000 $BUD
const MIN_TERP_REWARD: uint64 = Uint64(5_000_000_000) // 5,000 $TERP
const MAX_TERP_REWARD: uint64 = Uint64(50_000_000_000) // 50,000 $TERP
const SLOT_TOKEN_COST: uint64 = Uint64(2_500_000_000) // 2,500 $BUD
const HARVESTS_FOR_SLOT: uint64 = Uint64(5)
const MAX_POD_SLOTS: uint64 = Uint64(5)

export class GrowPodEmpire extends Contract {
  // ========== GLOBAL STATE (8 keys: 6 uint + 2 bytes) ==========
  owner = GlobalState<bytes>({ key: 'owner' })
  period = GlobalState<uint64>({ key: 'period' })
  cleanupCost = GlobalState<uint64>({ key: 'cleanup_cost' })
  breedCost = GlobalState<uint64>({ key: 'breed_cost' })
  budAsset = GlobalState<uint64>({ key: 'bud_asset' })
  terpAsset = GlobalState<uint64>({ key: 'terp_asset' })
  slotAsset = GlobalState<uint64>({ key: 'slot_asset' })
  terpRegistry = GlobalState<bytes>({ key: 'terp_registry' })

  // ========== LOCAL STATE - POD 1 (5 uint + 2 bytes) ==========
  stage = LocalState<uint64>({ key: 'stage' })
  waterCount = LocalState<uint64>({ key: 'water_count' })
  lastWatered = LocalState<uint64>({ key: 'last_watered' })
  nutrientCount = LocalState<uint64>({ key: 'nutrient_count' })
  lastNutrients = LocalState<uint64>({ key: 'last_nutrients' })
  dna = LocalState<bytes>({ key: 'dna' })
  terpeneProfile = LocalState<bytes>({ key: 'terpene_profile' })

  // ========== LOCAL STATE - POD 2 (5 uint + 2 bytes) ==========
  stage2 = LocalState<uint64>({ key: 'stage_2' })
  waterCount2 = LocalState<uint64>({ key: 'water_count_2' })
  lastWatered2 = LocalState<uint64>({ key: 'last_watered_2' })
  nutrientCount2 = LocalState<uint64>({ key: 'nutrient_count_2' })
  lastNutrients2 = LocalState<uint64>({ key: 'last_nutrients_2' })
  dna2 = LocalState<bytes>({ key: 'dna_2' })
  terpeneProfile2 = LocalState<bytes>({ key: 'terpene_profile_2' })

  // ========== LOCAL STATE - SLOT PROGRESSION (2 uint) ==========
  harvestCount = LocalState<uint64>({ key: 'harvest_count' })
  podSlots = LocalState<uint64>({ key: 'pod_slots' })

  // ========== LIFECYCLE METHODS ==========

  public createApplication(): void {
    this.owner.value = Txn.sender.bytes
    this.period.value = GROWTH_CYCLE
    this.cleanupCost.value = CLEANUP_BURN
    this.breedCost.value = BREED_BURN
    this.budAsset.value = Uint64(0)
    this.terpAsset.value = Uint64(0)
    this.slotAsset.value = Uint64(0)
    this.terpRegistry.value = Bytes('')
  }

  public optInToApplication(): void {
    // Pod 1
    this.stage(Txn.sender).value = Uint64(0)
    this.waterCount(Txn.sender).value = Uint64(0)
    this.lastWatered(Txn.sender).value = Uint64(0)
    this.nutrientCount(Txn.sender).value = Uint64(0)
    this.lastNutrients(Txn.sender).value = Uint64(0)
    this.dna(Txn.sender).value = Bytes('')
    this.terpeneProfile(Txn.sender).value = Bytes('')
    // Pod 2
    this.stage2(Txn.sender).value = Uint64(0)
    this.waterCount2(Txn.sender).value = Uint64(0)
    this.lastWatered2(Txn.sender).value = Uint64(0)
    this.nutrientCount2(Txn.sender).value = Uint64(0)
    this.lastNutrients2(Txn.sender).value = Uint64(0)
    this.dna2(Txn.sender).value = Bytes('')
    this.terpeneProfile2(Txn.sender).value = Bytes('')
    // Slot progression — start with 2 pod slots
    this.harvestCount(Txn.sender).value = Uint64(0)
    this.podSlots(Txn.sender).value = Uint64(2)
  }

  public updateApplication(): void {
    assert(Txn.sender.bytes === this.owner.value)
  }

  public deleteApplication(): void {
    assert(Txn.sender.bytes === this.owner.value)
  }

  // ========== ADMIN METHODS ==========

  public bootstrap(): void {
    assert(Txn.sender.bytes === this.owner.value)
    assert(this.budAsset.value === Uint64(0))
    assert(this.terpAsset.value === Uint64(0))

    // Create $BUD ASA — 10B supply, 6 decimals
    const budTxn = itxn
      .assetConfig({
        total: Uint64(10_000_000_000_000_000n),
        decimals: 6,
        unitName: 'BUD',
        assetName: 'GrowPod BUD',
        url: 'https://growpod.empire/bud',
        manager: Global.currentApplicationAddress,
        reserve: Global.currentApplicationAddress,
        freeze: Global.currentApplicationAddress,
        clawback: Global.currentApplicationAddress,
        fee: Uint64(0),
      })
      .submit()
    this.budAsset.value = budTxn.createdAsset.id

    // Create $TERP ASA — 100M supply, 6 decimals
    const terpTxn = itxn
      .assetConfig({
        total: 100_000_000_000_000,
        decimals: 6,
        unitName: 'TERP',
        assetName: 'GrowPod TERP',
        url: 'https://growpod.empire/terp',
        manager: Global.currentApplicationAddress,
        reserve: Global.currentApplicationAddress,
        freeze: Global.currentApplicationAddress,
        clawback: Global.currentApplicationAddress,
        fee: Uint64(0),
      })
      .submit()
    this.terpAsset.value = terpTxn.createdAsset.id

    // Create Slot Token ASA — 1M supply, 0 decimals
    const slotTxn = itxn
      .assetConfig({
        total: 1_000_000,
        decimals: 0,
        unitName: 'SLOT',
        assetName: 'GrowPod Slot Token',
        url: 'https://growpod.empire/slot',
        manager: Global.currentApplicationAddress,
        reserve: Global.currentApplicationAddress,
        freeze: Global.currentApplicationAddress,
        clawback: Global.currentApplicationAddress,
        fee: Uint64(0),
      })
      .submit()
    this.slotAsset.value = slotTxn.createdAsset.id
  }

  public setAsaIds(budId: uint64, terpId: uint64, slotId: uint64): void {
    assert(Txn.sender.bytes === this.owner.value)
    this.budAsset.value = budId
    this.terpAsset.value = terpId
    this.slotAsset.value = slotId
  }

  // ========== POD 1 METHODS ==========

  public mintPod(): void {
    assert(this.stage(Txn.sender).value === Uint64(0))
    this.dna(Txn.sender).value = op.sha256(
      op.concat(op.concat(Txn.sender.bytes, op.itob(Global.latestTimestamp)), op.itob(Global.round)),
    )
    this.stage(Txn.sender).value = Uint64(1)
    this.waterCount(Txn.sender).value = Uint64(0)
    this.lastWatered(Txn.sender).value = Uint64(0)
    this.nutrientCount(Txn.sender).value = Uint64(0)
    this.lastNutrients(Txn.sender).value = Uint64(0)
    this.terpeneProfile(Txn.sender).value = op.sha256(
      op.concat(op.concat(Bytes('terp'), Txn.sender.bytes), op.itob(Global.latestTimestamp)),
    )
  }

  public water(cooldownSeconds: uint64): void {
    assert(this.stage(Txn.sender).value >= Uint64(1))
    assert(this.stage(Txn.sender).value <= Uint64(4))
    assert(cooldownSeconds >= WATER_COOLDOWN_MIN)

    const lastWateredTime: uint64 = this.lastWatered(Txn.sender).value
    if (lastWateredTime !== Uint64(0)) {
      assert(Global.latestTimestamp - lastWateredTime >= cooldownSeconds)
    }

    this.lastWatered(Txn.sender).value = Global.latestTimestamp
    const newWaterCount: uint64 = this.waterCount(Txn.sender).value + Uint64(1)
    this.waterCount(Txn.sender).value = newWaterCount

    // Stage progression based on water count
    if (newWaterCount >= Uint64(10)) {
      this.stage(Txn.sender).value = Uint64(5) // Ready to harvest
    } else if (newWaterCount === Uint64(3)) {
      this.stage(Txn.sender).value = Uint64(2)
    } else if (newWaterCount === Uint64(6)) {
      this.stage(Txn.sender).value = Uint64(3)
    } else if (newWaterCount === Uint64(8)) {
      this.stage(Txn.sender).value = Uint64(4)
    }
  }

  public nutrients(): void {
    assert(this.stage(Txn.sender).value >= Uint64(1))
    assert(this.stage(Txn.sender).value <= Uint64(4))

    const lastNutrientTime: uint64 = this.lastNutrients(Txn.sender).value
    if (lastNutrientTime !== Uint64(0)) {
      assert(Global.latestTimestamp - lastNutrientTime >= NUTRIENT_COOLDOWN)
    }

    this.lastNutrients(Txn.sender).value = Global.latestTimestamp
    this.nutrientCount(Txn.sender).value = this.nutrientCount(Txn.sender).value + Uint64(1)
  }

  public harvest(): void {
    assert(this.stage(Txn.sender).value === Uint64(5))
    assert(this.budAsset.value !== Uint64(0))

    let yieldAmount: uint64 = BASE_YIELD
    // 20% bonus for 10+ waterings
    if (this.waterCount(Txn.sender).value >= Uint64(10)) {
      yieldAmount = yieldAmount + (BASE_YIELD * Uint64(20)) / Uint64(100)
    }
    // 30% bonus for 10+ nutrients
    if (this.nutrientCount(Txn.sender).value >= Uint64(10)) {
      yieldAmount = yieldAmount + (BASE_YIELD * Uint64(30)) / Uint64(100)
    }

    itxn
      .assetTransfer({
        xferAsset: Asset(this.budAsset.value),
        assetAmount: yieldAmount,
        assetReceiver: Txn.sender,
        fee: Uint64(0),
      })
      .submit()

    this.stage(Txn.sender).value = Uint64(6) // Needs cleanup
    this.harvestCount(Txn.sender).value = this.harvestCount(Txn.sender).value + Uint64(1)
  }

  public cleanup(budBurn: gtxn.AssetTransferTxn): void {
    assert(this.stage(Txn.sender).value === Uint64(6))
    assert(this.budAsset.value !== Uint64(0))

    // Verify the preceding BUD burn transaction
    assert(budBurn.xferAsset === Asset(this.budAsset.value))
    assert(budBurn.assetAmount >= CLEANUP_BURN)
    assert(budBurn.assetReceiver === Global.currentApplicationAddress)

    // Reset pod 1 state
    this.stage(Txn.sender).value = Uint64(0)
    this.waterCount(Txn.sender).value = Uint64(0)
    this.lastWatered(Txn.sender).value = Uint64(0)
    this.nutrientCount(Txn.sender).value = Uint64(0)
    this.lastNutrients(Txn.sender).value = Uint64(0)
    this.dna(Txn.sender).value = Bytes('')
    this.terpeneProfile(Txn.sender).value = Bytes('')
  }

  // ========== POD 2 METHODS ==========

  public mintPod2(): void {
    assert(this.stage2(Txn.sender).value === Uint64(0))
    this.dna2(Txn.sender).value = op.sha256(
      op.concat(op.concat(op.concat(Txn.sender.bytes, op.itob(Global.latestTimestamp)), op.itob(Global.round)), Bytes('pod2')),
    )
    this.stage2(Txn.sender).value = Uint64(1)
    this.waterCount2(Txn.sender).value = Uint64(0)
    this.lastWatered2(Txn.sender).value = Uint64(0)
    this.nutrientCount2(Txn.sender).value = Uint64(0)
    this.lastNutrients2(Txn.sender).value = Uint64(0)
    this.terpeneProfile2(Txn.sender).value = op.sha256(
      op.concat(op.concat(Bytes('terp2'), Txn.sender.bytes), op.itob(Global.latestTimestamp)),
    )
  }

  public water2(cooldownSeconds: uint64): void {
    assert(this.stage2(Txn.sender).value >= Uint64(1))
    assert(this.stage2(Txn.sender).value <= Uint64(4))
    assert(cooldownSeconds >= WATER_COOLDOWN_MIN)

    const lastWateredTime: uint64 = this.lastWatered2(Txn.sender).value
    if (lastWateredTime !== Uint64(0)) {
      assert(Global.latestTimestamp - lastWateredTime >= cooldownSeconds)
    }

    this.lastWatered2(Txn.sender).value = Global.latestTimestamp
    const newWaterCount: uint64 = this.waterCount2(Txn.sender).value + Uint64(1)
    this.waterCount2(Txn.sender).value = newWaterCount

    if (newWaterCount >= Uint64(10)) {
      this.stage2(Txn.sender).value = Uint64(5)
    } else if (newWaterCount === Uint64(3)) {
      this.stage2(Txn.sender).value = Uint64(2)
    } else if (newWaterCount === Uint64(6)) {
      this.stage2(Txn.sender).value = Uint64(3)
    } else if (newWaterCount === Uint64(8)) {
      this.stage2(Txn.sender).value = Uint64(4)
    }
  }

  public nutrients2(): void {
    assert(this.stage2(Txn.sender).value >= Uint64(1))
    assert(this.stage2(Txn.sender).value <= Uint64(4))

    const lastNutrientTime: uint64 = this.lastNutrients2(Txn.sender).value
    if (lastNutrientTime !== Uint64(0)) {
      assert(Global.latestTimestamp - lastNutrientTime >= NUTRIENT_COOLDOWN)
    }

    this.lastNutrients2(Txn.sender).value = Global.latestTimestamp
    this.nutrientCount2(Txn.sender).value = this.nutrientCount2(Txn.sender).value + Uint64(1)
  }

  public harvest2(): void {
    assert(this.stage2(Txn.sender).value === Uint64(5))
    assert(this.budAsset.value !== Uint64(0))

    let yieldAmount: uint64 = BASE_YIELD
    if (this.waterCount2(Txn.sender).value >= Uint64(10)) {
      yieldAmount = yieldAmount + (BASE_YIELD * Uint64(20)) / Uint64(100)
    }
    if (this.nutrientCount2(Txn.sender).value >= Uint64(10)) {
      yieldAmount = yieldAmount + (BASE_YIELD * Uint64(30)) / Uint64(100)
    }

    itxn
      .assetTransfer({
        xferAsset: Asset(this.budAsset.value),
        assetAmount: yieldAmount,
        assetReceiver: Txn.sender,
        fee: Uint64(0),
      })
      .submit()

    this.stage2(Txn.sender).value = Uint64(6)
    this.harvestCount(Txn.sender).value = this.harvestCount(Txn.sender).value + Uint64(1)
  }

  public cleanup2(budBurn: gtxn.AssetTransferTxn): void {
    assert(this.stage2(Txn.sender).value === Uint64(6))
    assert(this.budAsset.value !== Uint64(0))

    assert(budBurn.xferAsset === Asset(this.budAsset.value))
    assert(budBurn.assetAmount >= CLEANUP_BURN)
    assert(budBurn.assetReceiver === Global.currentApplicationAddress)

    this.stage2(Txn.sender).value = Uint64(0)
    this.waterCount2(Txn.sender).value = Uint64(0)
    this.lastWatered2(Txn.sender).value = Uint64(0)
    this.nutrientCount2(Txn.sender).value = Uint64(0)
    this.lastNutrients2(Txn.sender).value = Uint64(0)
    this.dna2(Txn.sender).value = Bytes('')
    this.terpeneProfile2(Txn.sender).value = Bytes('')
  }

  // ========== SHARED METHODS ==========

  public checkTerp(): void {
    assert(this.stage(Txn.sender).value === Uint64(6))
    assert(this.terpAsset.value !== Uint64(0))

    const profileHash: bytes = op.sha256(this.terpeneProfile(Txn.sender).value)
    const firstByte: uint64 = op.getByte(profileHash, Uint64(0))

    if (firstByte < Uint64(32)) {
      const terpReward: uint64 =
        MIN_TERP_REWARD +
        ((Uint64(32) - firstByte) * (MAX_TERP_REWARD - MIN_TERP_REWARD)) / Uint64(32)

      itxn
        .assetTransfer({
          xferAsset: Asset(this.terpAsset.value),
          assetAmount: terpReward,
          assetReceiver: Txn.sender,
          fee: Uint64(0),
        })
        .submit()
    }
  }

  public checkTerp2(): void {
    assert(this.stage2(Txn.sender).value === Uint64(6))
    assert(this.terpAsset.value !== Uint64(0))

    const profileHash: bytes = op.sha256(this.terpeneProfile2(Txn.sender).value)
    const firstByte: uint64 = op.getByte(profileHash, Uint64(0))

    if (firstByte < Uint64(32)) {
      const terpReward: uint64 =
        MIN_TERP_REWARD +
        ((Uint64(32) - firstByte) * (MAX_TERP_REWARD - MIN_TERP_REWARD)) / Uint64(32)

      itxn
        .assetTransfer({
          xferAsset: Asset(this.terpAsset.value),
          assetAmount: terpReward,
          assetReceiver: Txn.sender,
          fee: Uint64(0),
        })
        .submit()
    }
  }

  public breed(budBurn: gtxn.AssetTransferTxn): void {
    assert(this.budAsset.value !== Uint64(0))

    // Verify the preceding BUD burn transaction
    assert(budBurn.xferAsset === Asset(this.budAsset.value))
    assert(budBurn.assetAmount >= BREED_BURN)
    assert(budBurn.assetReceiver === Global.currentApplicationAddress)
  }

  // ========== SLOT PROGRESSION METHODS ==========

  public claimSlotToken(budBurn: gtxn.AssetTransferTxn): void {
    assert(this.slotAsset.value !== Uint64(0))
    assert(this.budAsset.value !== Uint64(0))
    assert(this.harvestCount(Txn.sender).value >= HARVESTS_FOR_SLOT)

    // Verify the preceding BUD burn transaction
    assert(budBurn.xferAsset === Asset(this.budAsset.value))
    assert(budBurn.assetAmount >= SLOT_TOKEN_COST)
    assert(budBurn.assetReceiver === Global.currentApplicationAddress)

    // Mint 1 Slot Token to user
    itxn
      .assetTransfer({
        xferAsset: Asset(this.slotAsset.value),
        assetAmount: Uint64(1),
        assetReceiver: Txn.sender,
        fee: Uint64(0),
      })
      .submit()

    // Deduct harvests (preserves carryover)
    this.harvestCount(Txn.sender).value =
      this.harvestCount(Txn.sender).value - HARVESTS_FOR_SLOT
  }

  public unlockSlot(slotBurn: gtxn.AssetTransferTxn): void {
    assert(this.slotAsset.value !== Uint64(0))
    assert(this.podSlots(Txn.sender).value < MAX_POD_SLOTS)

    // Verify the preceding Slot Token burn
    assert(slotBurn.xferAsset === Asset(this.slotAsset.value))
    assert(slotBurn.assetAmount === Uint64(1))
    assert(slotBurn.assetReceiver === Global.currentApplicationAddress)

    // Increment pod slots
    this.podSlots(Txn.sender).value = this.podSlots(Txn.sender).value + Uint64(1)
  }
}
