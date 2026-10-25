import { describe, it, expect } from "vitest";
import { makeCalibration, classifyStance, TALL_MARGIN, DUCK_OFFSET } from "./calibration";

describe("makeCalibration", () => {
  it("derives tall/duck thresholds around the ready stance", () => {
    const cal = makeCalibration(0.75);
    expect(cal.ready).toBe(0.75);
    expect(cal.tallThreshold).toBeCloseTo(0.75 - TALL_MARGIN);
    expect(cal.duckThreshold).toBeCloseTo(0.75 + DUCK_OFFSET);
  });
});

describe("classifyStance", () => {
  const cal = makeCalibration(0.75); // tall < 0.70 ; ready [0.70, 0.82) ; duck ≥ 0.82

  it("is READY at the calibrated stance", () => {
    expect(classifyStance(0.75, cal)).toBe("ready");
  });

  it("is TALL when hips are well above the stance", () => {
    expect(classifyStance(0.62, cal)).toBe("tall");
  });

  it("is DUCK when hips drop well below the stance", () => {
    expect(classifyStance(0.85, cal)).toBe("duck");
  });

  it("treats no reading or no calibration as TALL", () => {
    expect(classifyStance(null, cal)).toBe("tall");
    expect(classifyStance(0.75, null)).toBe("tall");
  });
});
