import { describe, expect, it } from "bun:test";
import {
  computeCarbonEstimate,
  computeExitWaterfall,
  computeIllustrativeHedgeProtection,
  computeHiringScenario,
  getDepartmentFullyLoadedAnnualCost,
  type HiringDepartment,
} from "./strategy-models";

describe("Phase 6 strategy estimates", () => {
  it("computes carbon savings from moving workload to a lower-emissions region", () => {
    const result = computeCarbonEstimate({
      monthlyMwh: 100,
      usEastTonnesPerMwh: 0.4,
      europeNorthTonnesPerMwh: 0.1,
      relocationPct: 50,
      carbonPricePerTonne: 100,
      offsetPricePerTonne: 20,
      annualRelocationCost: 0,
    });
    expect(result.baselineEmissions).toBe(480);
    expect(result.projectedEmissions).toBe(300);
    expect(result.netCarbonRoi).toBe(21_600);
  });

  it("applies debt and preferred claims before founder and ESOP proceeds", () => {
    const result = computeExitWaterfall({
      arr: 10_000_000,
      revenueMultiple: 2,
      acquisitionPremiumPct: 0,
      ventureDebt: 2_000_000,
      preferredPreference: 8_000_000,
      founderOwnershipPct: 60,
      esopOwnershipPct: 10,
      exitTaxPct: 25,
    });
    expect(result.debtPaid).toBe(2_000_000);
    expect(result.preferredPaid).toBe(8_000_000);
    expect(result.founderAfterTax).toBe(4_500_000);
    expect(result.esopAfterTax).toBe(750_000);
  });

  it("includes salary, benefits, software seats, and hardware in employee cost", () => {
    const department: HiringDepartment = {
      id: "engineering",
      name: "Engineering",
      headcount: 2,
      averageSalary: 100_000,
      benefitsPct: 20,
      saasPerEmployeeMonthly: 100,
      hardwarePerEmployeeMonthly: 50,
      teams: [],
    };
    expect(getDepartmentFullyLoadedAnnualCost(department)).toBe(250_000);
    expect(computeHiringScenario([department], "freeze").plannedHires).toBe(0);
    expect(computeHiringScenario([department], "aggressive").plannedHires).toBe(1);
  });

  it("uses the requested illustrative USD/INR forward and payroll notional", () => {
    expect(getDepartmentFullyLoadedAnnualCost).toBeDefined();
    expect(computeIllustrativeHedgeProtection(200_000, 3)).toBe(6_000);
  });
});