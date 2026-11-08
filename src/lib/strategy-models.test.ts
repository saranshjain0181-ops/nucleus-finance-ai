import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  computeCarbonEstimate,
  computeExitWaterfall,
  computeIllustrativeHedgeProtection,
  computeHiringScenario,
  getDepartmentFullyLoadedAnnualCost,
  type HiringDepartment,
} from "./strategy-models";

test("lower-carbon relocation reduces projected emissions and calculates net ROI", () => {
    const result = computeCarbonEstimate({
      monthlyMwh: 100,
      usEastTonnesPerMwh: 0.4,
      europeNorthTonnesPerMwh: 0.1,
      relocationPct: 50,
      carbonPricePerTonne: 100,
      offsetPricePerTonne: 20,
      annualRelocationCost: 0,
    });
    assert.equal(result.baselineEmissions, 480);
    assert.equal(result.projectedEmissions, 300);
    assert.equal(result.netCarbonRoi, 21_600);
});

test("exit waterfall pays debt and preferred claims before founder and ESOP", () => {
    const exit = computeExitWaterfall({
      arr: 10_000_000,
      revenueMultiple: 2,
      acquisitionPremiumPct: 0,
      ventureDebt: 2_000_000,
      preferredPreference: 8_000_000,
      founderOwnershipPct: 60,
      esopOwnershipPct: 10,
      exitTaxPct: 25,
    });
    assert.equal(exit.debtPaid, 2_000_000);
    assert.equal(exit.preferredPaid, 8_000_000);
    assert.equal(exit.founderAfterTax, 4_500_000);
    assert.equal(exit.esopAfterTax, 750_000);
});

test("fully-loaded department cost includes salary, benefits, software seats, and hardware", () => {
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
    assert.equal(getDepartmentFullyLoadedAnnualCost(department), 243_600);
    assert.equal(computeHiringScenario([department], "freeze").plannedHires, 0);
    assert.equal(computeHiringScenario([department], "aggressive").plannedHires, 1);
});

test("FX payroll estimate calculates the specified 3 percent exposure", () => {
  assert.equal(computeIllustrativeHedgeProtection(200_000, 3), 6_000);
});