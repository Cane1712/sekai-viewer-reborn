import { describe, expect, it } from "vitest";
import { getVirtualLiveBannerBundle } from "$lib/domain/virtual-live";
import { parseVirtualLiveDetail } from "./virtual-live-detail";
import { parseVirtualLiveListPage } from "./virtual-live-list";

const box = (resourceType: string, resourceId: number, resourceQuantity: number) => ({
  id: 1,
  resourceBoxPurpose: "virtual_live_total_cheer_point_reward",
  details: [{ resourceType, resourceId, resourceQuantity, seq: 1, resourceName: "Item" }]
});

describe("parseVirtualLiveDetail", () => {
  it("reads a solo live's Cheer Coin rewards, surplus reward, coin, and group banner", () => {
    const detail = parseVirtualLiveDetail({
      id: 491,
      name: "6th Anniversary スペシャルソロライブ（一歌）",
      virtualLiveType: "solo_virtual_live",
      assetbundleName: "vlentrance_00491",
      virtualLiveGroup: { id: 2, name: "Solo", assetbundleName: "6th_anniversary_soro_live" },
      virtualLiveTotalCheerPointRewards: [
        {
          id: 2,
          threshold: 900,
          resourceBoxId: 101002,
          resourceBox: box("skill_practice_ticket", 10102, 5)
        },
        { id: 1, threshold: 300, resourceBoxId: 101001, resourceBox: box("material", 101, 100) }
      ],
      virtualLiveTotalCheerPointSurplusReward: {
        basePoint: 10,
        resourceBoxId: 1,
        resourceBox: box("material", 101, 1)
      },
      virtualLiveVirtualItemOverrideCost: {
        costResourceType: "material",
        costResourceId: 282,
        costResourceName: "バーチャルエールコイン"
      }
    });

    expect(detail?.totalCheerPointRewards.map((reward) => reward.threshold)).toEqual([300, 900]);
    expect(detail?.totalCheerPointRewards[0]?.resourceBox?.details[0]).toMatchObject({
      resourceType: "material",
      resourceId: 101,
      resourceQuantity: 100,
      resourceName: "Item"
    });
    expect(detail?.totalCheerPointSurplusReward?.basePoint).toBe(10);
    expect(detail?.virtualItemOverrideCost).toEqual({
      costResourceType: "material",
      costResourceId: 282,
      costResourceName: "バーチャルエールコイン"
    });
    expect(detail && getVirtualLiveBannerBundle(detail)).toBe("6th_anniversary_soro_live");
  });

  it("leaves the solo fields empty for other lives and keeps their own banner", () => {
    const detail = parseVirtualLiveDetail({
      id: 490,
      name: "Live",
      virtualLiveType: "normal",
      assetbundleName: "vlentrance_00490",
      virtualLiveTotalCheerPointRewards: [],
      virtualLiveTotalCheerPointSurplusReward: null,
      virtualLiveVirtualItemOverrideCost: null
    });

    expect(detail?.totalCheerPointRewards).toEqual([]);
    expect(detail?.totalCheerPointSurplusReward).toBeNull();
    expect(detail?.virtualItemOverrideCost).toBeNull();
    expect(detail && getVirtualLiveBannerBundle(detail)).toBe("vlentrance_00490");
  });
});

describe("parseVirtualLiveListPage", () => {
  it("reads a grouped live's group banner", () => {
    const page = parseVirtualLiveListPage(
      {
        items: [
          {
            id: 491,
            name: "Solo",
            assetbundleName: "vlentrance_00491",
            virtualLiveGroup: { id: 2, assetbundleName: "6th_anniversary_soro_live" }
          },
          { id: 490, name: "Live", assetbundleName: "vlentrance_00490" }
        ]
      },
      1,
      20
    );

    expect(page.items.map(getVirtualLiveBannerBundle)).toEqual([
      "6th_anniversary_soro_live",
      "vlentrance_00490"
    ]);
  });
});
