const BALANCE_SECTIONS = [
  {
    key: 'currentAssets',
    title: '流动资产',
    fields: [
      { key: 'cash', label: '货币资金', hint: '现金、银行存款及其他货币资金' },
      { key: 'accountsReceivable', label: '应收账款', hint: '客户尚未支付的款项' },
      { key: 'inventory', label: '存货', hint: '商品、原材料和在产品' },
      { key: 'otherCurrentAssets', label: '其他流动资产', hint: '预付款及其他短期资产' }
    ]
  },
  {
    key: 'nonCurrentAssets',
    title: '非流动资产',
    fields: [
      { key: 'fixedAssets', label: '固定资产净值', hint: '固定资产原值减累计折旧' },
      { key: 'otherNonCurrentAssets', label: '其他非流动资产', hint: '长期投资、无形资产等' }
    ]
  },
  {
    key: 'currentLiabilities',
    title: '流动负债',
    fields: [
      { key: 'shortTermLoans', label: '短期借款', hint: '一年内需要偿还的借款' },
      { key: 'accountsPayable', label: '应付账款', hint: '尚未支付给供应商的款项' },
      { key: 'taxesPayable', label: '应交税费', hint: '尚未缴纳的税费' },
      { key: 'otherCurrentLiabilities', label: '其他流动负债', hint: '工资、其他应付款等' }
    ]
  },
  {
    key: 'nonCurrentLiabilities',
    title: '非流动负债',
    fields: [
      { key: 'longTermLoans', label: '长期借款', hint: '一年以上到期的借款' },
      { key: 'otherNonCurrentLiabilities', label: '其他非流动负债', hint: '长期应付款等' }
    ]
  },
  {
    key: 'equity',
    title: '所有者权益',
    fields: [
      { key: 'paidInCapital', label: '实收资本', hint: '股东实际投入资本' },
      { key: 'retainedEarnings', label: '未分配利润', hint: '累计未分配利润，可填写负数', allowNegative: true },
      { key: 'otherEquity', label: '其他所有者权益', hint: '资本公积、盈余公积等' }
    ]
  }
]

const PROFIT_SECTIONS = [
  {
    key: 'revenue',
    title: '营业收入',
    fields: [
      { key: 'mainRevenue', label: '主营业务收入', hint: '主要经营活动产生的收入' },
      { key: 'otherRevenue', label: '其他业务收入', hint: '其他经营活动产生的收入' }
    ]
  },
  {
    key: 'cost',
    title: '成本与费用',
    fields: [
      { key: 'mainCost', label: '主营业务成本', hint: '与主营收入对应的成本' },
      { key: 'taxesAndSurcharges', label: '税金及附加', hint: '城建税、教育费附加等' },
      { key: 'sellingExpenses', label: '销售费用', hint: '推广、运输和销售人员费用等' },
      { key: 'adminExpenses', label: '管理费用', hint: '办公、管理人员和房租等' },
      { key: 'rdExpenses', label: '研发费用', hint: '研发活动相关费用' },
      { key: 'financeExpenses', label: '财务费用', hint: '利息和手续费等' }
    ]
  },
  {
    key: 'otherProfit',
    title: '其他损益',
    fields: [
      { key: 'otherIncome', label: '其他收益', hint: '政府补助等其他收益' },
      { key: 'nonOperatingIncome', label: '营业外收入', hint: '与日常经营无直接关系的收入' },
      { key: 'nonOperatingExpense', label: '营业外支出', hint: '与日常经营无直接关系的支出' },
      { key: 'incomeTax', label: '所得税费用', hint: '本期所得税费用' }
    ]
  }
]

function pad(value) {
  return value < 10 ? '0' + value : String(value)
}

function formatDate(date) {
  const target = date || new Date()
  return target.getFullYear() + '-' + pad(target.getMonth() + 1) + '-' + pad(target.getDate())
}

function currentMonth() {
  return formatDate(new Date()).slice(0, 7)
}

function shiftMonth(month, delta) {
  const parts = String(month || '').split('-')
  const year = Number(parts[0])
  const mon = Number(parts[1])
  if (!year || !mon) return currentMonth()
  const date = new Date(year, mon - 1 + delta, 1)
  return date.getFullYear() + '-' + pad(date.getMonth() + 1)
}

function monthLabel(month) {
  const parts = String(month || '').split('-')
  if (parts.length !== 2) return month
  return parts[0] + '年' + Number(parts[1]) + '月'
}

function parseMoneyToCents(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  const normalized = String(value == null ? '' : value).replace(/,/g, '').trim()
  if (!normalized || normalized === '-' || normalized === '.') return 0
  const number = Number(normalized)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100)
}

function formatMoneyFromCents(cents, emptyForZero) {
  const value = Number(cents) || 0
  if (emptyForZero && value === 0) return ''
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  const integer = Math.floor(absolute / 100)
  const decimal = pad(absolute % 100)
  return sign + String(integer).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + decimal
}


function formatInputMoney(cents) {
  const value = Number(cents) || 0
  if (value === 0) return ''
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  return sign + Math.floor(absolute / 100) + '.' + pad(absolute % 100)
}

function formatCompactMoney(cents) {
  const value = Number(cents) || 0
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absolute >= 1000000) return sign + (absolute / 1000000).toFixed(1) + '万'
  return sign + formatMoneyFromCents(absolute, false)
}

function percent(numerator, denominator) {
  if (!denominator) return '—'
  return ((numerator / denominator) * 100).toFixed(1) + '%'
}

function createAmountMap(sections) {
  const map = {}
  sections.forEach(function (section) {
    section.fields.forEach(function (field) {
      map[field.key] = 0
    })
  })
  return map
}

function createEmptyReport(month) {
  return {
    id: month,
    month: month,
    status: 'draft',
    version: 1,
    balance: createAmountMap(BALANCE_SECTIONS),
    profit: createAmountMap(PROFIT_SECTIONS),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    confirmedAt: 0
  }
}

function sumValues(source, keys) {
  return keys.reduce(function (sum, key) {
    return sum + (Number(source[key]) || 0)
  }, 0)
}

function calculateBalance(balance) {
  const source = balance || {}
  const currentAssets = sumValues(source, ['cash', 'accountsReceivable', 'inventory', 'otherCurrentAssets'])
  const nonCurrentAssets = sumValues(source, ['fixedAssets', 'otherNonCurrentAssets'])
  const assets = currentAssets + nonCurrentAssets
  const currentLiabilities = sumValues(source, ['shortTermLoans', 'accountsPayable', 'taxesPayable', 'otherCurrentLiabilities'])
  const nonCurrentLiabilities = sumValues(source, ['longTermLoans', 'otherNonCurrentLiabilities'])
  const liabilities = currentLiabilities + nonCurrentLiabilities
  const equity = sumValues(source, ['paidInCapital', 'retainedEarnings', 'otherEquity'])
  return {
    currentAssets: currentAssets,
    nonCurrentAssets: nonCurrentAssets,
    assets: assets,
    currentLiabilities: currentLiabilities,
    nonCurrentLiabilities: nonCurrentLiabilities,
    liabilities: liabilities,
    equity: equity,
    liabilitiesAndEquity: liabilities + equity,
    difference: assets - liabilities - equity
  }
}

function calculateProfit(profit) {
  const source = profit || {}
  const revenue = sumValues(source, ['mainRevenue', 'otherRevenue'])
  const operatingCosts = sumValues(source, ['mainCost', 'taxesAndSurcharges', 'sellingExpenses', 'adminExpenses', 'rdExpenses', 'financeExpenses'])
  const grossProfit = revenue - (Number(source.mainCost) || 0)
  const operatingProfit = revenue - operatingCosts + (Number(source.otherIncome) || 0)
  const profitBeforeTax = operatingProfit + (Number(source.nonOperatingIncome) || 0) - (Number(source.nonOperatingExpense) || 0)
  const netProfit = profitBeforeTax - (Number(source.incomeTax) || 0)
  return {
    revenue: revenue,
    operatingCosts: operatingCosts,
    grossProfit: grossProfit,
    operatingProfit: operatingProfit,
    profitBeforeTax: profitBeforeTax,
    netProfit: netProfit,
    grossMargin: percent(grossProfit, revenue),
    netMargin: percent(netProfit, revenue)
  }
}

function calculateMetrics(report) {
  const balance = calculateBalance(report && report.balance)
  const profit = calculateProfit(report && report.profit)
  return {
    balance: balance,
    profit: profit,
    debtRatio: percent(balance.liabilities, balance.assets),
    currentRatio: balance.currentLiabilities ? (balance.currentAssets / balance.currentLiabilities).toFixed(2) : '—'
  }
}

function hasAnyData(report) {
  if (!report) return false
  const balanceKeys = Object.keys(report.balance || {})
  const profitKeys = Object.keys(report.profit || {})
  return balanceKeys.concat(profitKeys).some(function (key) {
    return (Number((report.balance || {})[key]) || Number((report.profit || {})[key]) || 0) !== 0
  })
}

function validateReport(report) {
  const metrics = calculateMetrics(report || createEmptyReport(currentMonth()))
  const errors = []
  const warnings = []

  if (!hasAnyData(report)) errors.push('请至少填写一项财务数据')
  if (metrics.balance.difference !== 0) {
    errors.push('资产总计与负债和所有者权益不平衡，相差 ¥' + formatMoneyFromCents(Math.abs(metrics.balance.difference), false))
  }

  if (metrics.balance.assets < 0) warnings.push('资产总额为负数，请检查填报数据')
  if (metrics.balance.liabilities > metrics.balance.assets && metrics.balance.assets > 0) warnings.push('负债总额高于资产总额，建议关注偿债风险')
  if (metrics.profit.revenue > 0 && (Number(report.balance.accountsReceivable) || 0) > metrics.profit.revenue) warnings.push('应收账款高于本月营业收入，建议关注回款情况')
  if (metrics.balance.currentLiabilities > 0 && (Number(report.balance.cash) || 0) * 2 < metrics.balance.currentLiabilities) warnings.push('货币资金不足流动负债的50%，建议关注短期资金压力')
  if (metrics.profit.revenue > 0 && metrics.profit.netProfit < 0) warnings.push('本月出现亏损，请检查成本和费用变化')

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    metrics: metrics
  }
}

function buildInputSections(sections, values) {
  const source = values || {}
  return sections.map(function (section) {
    return {
      key: section.key,
      title: section.title,
      fields: section.fields.map(function (field) {
        return {
          key: field.key,
          label: field.label,
          hint: field.hint,
          valueText: formatInputMoney(source[field.key]),
          inputType: field.allowNegative ? 'text' : 'digit'
        }
      })
    }
  })
}

function findFieldLabel(key) {
  const sections = BALANCE_SECTIONS.concat(PROFIT_SECTIONS)
  for (let i = 0; i < sections.length; i++) {
    for (let j = 0; j < sections[i].fields.length; j++) {
      if (sections[i].fields[j].key === key) return sections[i].fields[j].label
    }
  }
  return key
}

module.exports = {
  BALANCE_SECTIONS: BALANCE_SECTIONS,
  PROFIT_SECTIONS: PROFIT_SECTIONS,
  currentMonth: currentMonth,
  shiftMonth: shiftMonth,
  monthLabel: monthLabel,
  parseMoneyToCents: parseMoneyToCents,
  formatMoneyFromCents: formatMoneyFromCents,
  formatCompactMoney: formatCompactMoney,
  createEmptyReport: createEmptyReport,
  calculateBalance: calculateBalance,
  calculateProfit: calculateProfit,
  calculateMetrics: calculateMetrics,
  validateReport: validateReport,
  buildInputSections: buildInputSections,
  findFieldLabel: findFieldLabel
}
