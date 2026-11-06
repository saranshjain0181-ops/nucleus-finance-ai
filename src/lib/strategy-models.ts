export type CarbonEstimateInput = {
  monthlyMwh: number;
  usEastTonnesPerMwh: number;
  europeNorthTonnesPerMwh: number;
  relocationPct: number;
  carbonPricePerTonne: number;
  offsetPricePerTonne: number;
  annualRelocationCost: number;
};

export function computeCarbonEstimate(input: CarbonEstimateInput) {
  const monthlyMwh = Math.max(0, input.monthlyMwh);
  const relocationShare = Math.min(100, Math.max(0, input.relocationPct)) / 100;
  const annualMwh = monthlyMwh * 12;
  const baselineEmissions = annualMwh * Math.max(0, input.usEastTonnesPerMwh);
  const projectedIntensity =
    input.usEastTonnesPerMwh * (1 - relocationShare) +
    input.europeNorthTonnesPerMwh * relocationShare;
  const projectedEmissions = annualMwh * Math.max(0, projectedIntensity);
  const avoidedEmissions = Math.max(0, baselineEmissions - projectedEmissions);
  const baselineCarbonCost = baselineEmissions * Math.max(0, input.carbonPricePerTonne);
  const projectedCarbonCost = projectedEmissions * Math.max(0, input.carbonPricePerTonne);
  const offsetSavings = avoidedEmissions * Math.max(0, input.offsetPricePerTonne);
  const carbonTaxSavings = baselineCarbonCost - projectedCarbonCost;

  return {
    baselineEmissions,
    projectedEmissions,
    avoidedEmissions,
    baselineCarbonCost,
    projectedCarbonCost,
    carbonTaxSavings,
    offsetSavings,
    annualRelocationCost: Math.max(0, input.annualRelocationCost),
    netCarbonRoi: carbonTaxSavings + offsetSavings - Math.max(0, input.annualRelocationCost),
  };
}

export type HiringDepartment = {
  id: string;
  name: string;
  headcount: number;
  averageSalary: number;
  benefitsPct: number;
  saasPerEmployeeMonthly: number;
  hardwarePerEmployeeMonthly: number;
  teams: string[];
};

export function getDepartmentFullyLoadedAnnualCost(department: HiringDepartment) {
  const salaryAndBenefits = department.averageSalary * (1 + department.benefitsPct / 100);
  const recurringToolsAndHardware =
    (department.saasPerEmployeeMonthly + department.hardwarePerEmployeeMonthly) * 12;
  return (salaryAndBenefits + recurringToolsAndHardware) * department.headcount;
}

export function computeHiringScenario(
  departments: HiringDepartment[],
  scenario: "freeze" | "aggressive",
) {
  const existingHeadcount = departments.reduce((sum, department) => sum + department.headcount, 0);
  const hiresByDepartment = departments.map((department) => ({
    departmentId: department.id,
    hires: scenario === "aggressive" ? Math.ceil(department.headcount * 0.2) : 0,
  }));
  const plannedHires = hiresByDepartment.reduce((sum, row) => sum + row.hires, 0);
  const incrementalAnnualCost = hiresByDepartment.reduce((sum, row) => {
    const department = departments.find((item) => item.id === row.departmentId);
    if (!department) return sum;
    return (
      sum +
      row.hires *
        (department.averageSalary * (1 + department.benefitsPct / 100) +
          (department.saasPerEmployeeMonthly + department.hardwarePerEmployeeMonthly) * 12)
    );
  }, 0);

  return {
    existingHeadcount,
    plannedHires,
    projectedHeadcount: existingHeadcount + plannedHires,
    incrementalAnnualCost,
    hiresByDepartment,
  };
}

export type ExitWaterfallInput = {
  arr: number;
  revenueMultiple: number;
  acquisitionPremiumPct: number;
  ventureDebt: number;
  preferredPreference: number;
  founderOwnershipPct: number;
  esopOwnershipPct: number;
  exitTaxPct: number;
};

export function computeExitWaterfall(input: ExitWaterfallInput) {
  const grossExitValue =
    Math.max(0, input.arr) *
    Math.max(0, input.revenueMultiple) *
    (1 + Math.max(0, input.acquisitionPremiumPct) / 100);
  const debtPaid = Math.min(grossExitValue, Math.max(0, input.ventureDebt));
  const preferredPaid = Math.min(
    Math.max(0, grossExitValue - debtPaid),
    Math.max(0, input.preferredPreference),
  );
  const commonEquity = Math.max(0, grossExitValue - debtPaid - preferredPaid);
  const founderOwnership = Math.min(100, Math.max(0, input.founderOwnershipPct)) / 100;
  const esopOwnership = Math.min(
    Math.max(0, 100 - founderOwnership * 100),
    Math.max(0, input.esopOwnershipPct),
  ) / 100;
  const otherOwnership = Math.max(0, 1 - founderOwnership - esopOwnership);
  const founderPreTax = commonEquity * founderOwnership;
  const esopPreTax = commonEquity * esopOwnership;
  const otherCommonPreTax = commonEquity * otherOwnership;
  const taxRate = Math.min(100, Math.max(0, input.exitTaxPct)) / 100;
  const founderTax = founderPreTax * taxRate;
  const esopTax = esopPreTax * taxRate;
  const otherTax = otherCommonPreTax * taxRate;

  return {
    grossExitValue,
    debtPaid,
    preferredPaid,
    commonEquity,
    founderPreTax,
    founderTax,
    founderAfterTax: founderPreTax - founderTax,
    esopPreTax,
    esopTax,
    esopAfterTax: esopPreTax - esopTax,
    otherCommonPreTax,
    totalExitTax: founderTax + esopTax + otherTax,
  };
}

const FX_SERIES: Record<string, { base: number; move: number }> = {
  "USD/INR": { base: 84.5, move: 0.03 },
  "USD/EUR": { base: 0.92, move: 0.02 },
  "USD/GBP": { base: 0.79, move: 0.025 },
};

export function getIllustrativeFxSeries(pair: string) {
  const config = FX_SERIES[pair] ?? FX_SERIES["USD/INR"];
  const path = [0, 0.004, -0.002, 0.006, 0.003, 0.008, 0.005, 0.011, 0.007, 0.014, 0.01, config.move];
  return path.map((change, index) => ({
    period: `W${index + 1}`,
    rate: Number((config.base * (1 + change)).toFixed(4)),
  }));
}

export function computeIllustrativeHedgeProtection(notionalUsd: number, projectedMovePct: number) {
  return Math.max(0, notionalUsd) * (Math.max(0, projectedMovePct) / 100);
}