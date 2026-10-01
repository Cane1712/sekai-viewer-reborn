import type {
  SharedEventRewardRangeResponse,
  SharedEventRewardResourceBoxDetail
} from "@platform/sekai-master-api-sdk";
import { describe, expect, it } from "vitest";
import { adaptRewardHonor, selectRewardHonor } from "./reward-honor";

const detail = {
  resourceType: "honor",
  resourceLevel: 7,
  honor: {
    name: " Reward honor ",
    assetbundleName: "master",
    honorRarity: "high",
    group: { honorType: "character", frameName: "frame" },
    levels: [{ level: 7, assetbundleName: "level_seven", honorRarity: "middle" }]
  }
} satisfies SharedEventRewardResourceBoxDetail;

// Rank 1 of JP event 219, as /events/jp/219/rewards returns it.
const eventRankDetail = {
  resourceType: "honor",
  resourceLevel: 1,
  honor: {
    id: 8764,
    name: "1位",
    assetbundleName: "honor_top_000001",
    honorRarity: "highest",
    groupId: 679,
    group: { id: 679, honorType: "event", backgroundAssetbundleName: "honor_bg_event_ourways" },
    levels: [{ honorId: 8764, level: 1 }]
  }
} satisfies SharedEventRewardResourceBoxDetail;

describe("reward honor adapter", () => {
  it("maps regular honor fields and an explicit positive reward level", () => {
    expect(adaptRewardHonor(detail)).toEqual({
      kind: "normal",
      honorType: "regular",
      assetBundleName: "master",
      group: { frameName: "frame" },
      frameBundlePath: "local/honor",
      rarity: 2,
      level: 7,
      rankAsset: null
    });
  });

  it("draws event rank rewards on the event background with the rank overlay", () => {
    expect(adaptRewardHonor(eventRankDetail)).toMatchObject({
      kind: "normal",
      honorType: "event",
      assetBundleName: "honor_bg_event_ourways",
      rarity: 3,
      rankAsset: { bundlePath: "honor/honor_top_000001", resourceName: "rank_main.png" }
    });
  });

  it("omits an event reward without its rank art rather than inventing one", () => {
    expect(
      adaptRewardHonor({
        honor: {
          assetbundleName: "",
          group: { honorType: "event", backgroundAssetbundleName: "background" },
          levels: [{ level: 1, assetbundleName: "not_a_rank" }]
        }
      })
    ).toBeNull();
  });

  it("uses rank-match backgrounds and the app-local rarity frame", () => {
    expect(
      adaptRewardHonor({
        ...detail,
        honor: {
          ...detail.honor,
          group: { honorType: "rank_match", backgroundAssetbundleName: "season" }
        }
      })
    ).toEqual({
      kind: "rank-match",
      assetBundleName: "master",
      backgroundAssetBundleName: "season",
      rarity: 2,
      frameBundlePath: "local/honor"
    });
  });

  it("maps birthday honors at the rewarded level", () => {
    expect(
      adaptRewardHonor({
        resourceLevel: 7,
        honor: {
          assetbundleName: "birthday_honor",
          honorType: "birthday",
          levels: detail.honor.levels,
          group: { frameName: "birthday" }
        }
      })
    ).toMatchObject({
      kind: "normal",
      honorType: "birthday",
      level: 7,
      rarity: 1,
      assetBundleName: "birthday_honor",
      group: { frameName: "birthday" }
    });
  });

  it("falls back to the first positive level without mutating data", () => {
    const levels = [
      { level: 6, assetbundleName: "six" },
      { level: 0 },
      { level: 2, assetbundleName: "two" }
    ];
    expect(adaptRewardHonor({ honor: { assetbundleName: "base", levels } })).toMatchObject({
      level: 6
    });
    expect(levels.map((level) => level.level)).toEqual([6, 0, 2]);
  });

  it("omits unavailable and non-honor media rather than rendering a frame alone", () => {
    expect(adaptRewardHonor({})).toBeNull();
    expect(
      adaptRewardHonor({ honor: { name: "Name only", group: { frameName: "frame" } } })
    ).toBeNull();
    expect(adaptRewardHonor({ ...detail, resourceType: "bonds_honor" })).toBeNull();
    expect(
      adaptRewardHonor({
        honor: { assetbundleName: "bonds", honorType: "bonds_honor" }
      })
    ).toBeNull();
  });
});

describe("selectRewardHonor", () => {
  it("traverses multiple ranking rewards and details to find usable honor media", () => {
    const reward = {
      eventRankingRewards: [
        {},
        { resourceBox: { details: [{ resourceType: "jewel" }, { honor: { name: "Text only" } }] } },
        { resourceBox: { details: [detail, { honor: { assetbundleName: "later" } }] } }
      ]
    } satisfies SharedEventRewardRangeResponse;
    expect(selectRewardHonor(reward)).toEqual({
      label: "Reward honor",
      honor: adaptRewardHonor(detail)
    });
  });

  it("preserves name-only text when data or assets are missing", () => {
    expect(selectRewardHonor(null)).toEqual({ label: null, honor: null });
    expect(selectRewardHonor({})).toEqual({ label: null, honor: null });
    expect(
      selectRewardHonor({
        eventRankingRewards: [
          {
            resourceBox: {
              details: [{ honor: { name: " " } }, { honor: { name: " Name only " } }]
            }
          }
        ]
      })
    ).toEqual({ label: "Name only", honor: null });
  });

  it("keeps a bonds-honor name as text while omitting its renderer input", () => {
    expect(
      selectRewardHonor({
        eventRankingRewards: [
          {
            resourceBox: {
              details: [
                {
                  resourceType: "bonds_honor",
                  honor: { name: "Bonds Honor", assetbundleName: "bonds" }
                }
              ]
            }
          }
        ]
      })
    ).toEqual({ label: "Bonds Honor", honor: null });
  });
});
