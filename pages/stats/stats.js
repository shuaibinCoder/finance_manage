const store = require('../../utils/store')
const reportUtils = require('../../utils/report')

Page({
  data: {
    month: '',
    monthLabel: '',
    canPrev: true,
    canNext: false,
    status: 'draft',
    statusText: '未确认',
    activeTab: 'balance',
    balanceGroups: [],
    balanceTotals: {},
    profitRows: [],
    profitTotals: {},
    analysisCards: [],
    alerts: [],
    trend: [],
    hasData: false
  },

  onShow: function () {
    if (!store.getCompany()) {
      wx.redirectTo({ url: '/pages/setup/setup' })
      return
    }
    this.refresh()
  },

  refresh: function () {
    const month = store.getActiveMonth()
    const company = store.getCompany()
    const report = store.getReport(month)
    const validation = reportUtils.validateReport(report)
    const metrics = validation.metrics
    this.setData({
      month: month,
      monthLabel: reportUtils.monthLabel(month),
      canPrev: month > company.startMonth,
      canNext: month < reportUtils.currentMonth(),
      status: report.status,
      statusText: report.status === 'confirmed' ? '已确认' : '未确认',
      hasData: store.hasReport(month),
      balanceGroups: this.buildBalanceGroups(report),
      balanceTotals: {
        assets: this.money(metrics.balance.assets),
        liabilities: this.money(metrics.balance.liabilities),
        equity: this.money(metrics.balance.equity),
        liabilitiesAndEquity: this.money(metrics.balance.liabilitiesAndEquity),
        difference: this.money(Math.abs(metrics.balance.difference)),
        balanced: metrics.balance.difference === 0
      },
      profitRows: this.buildProfitRows(report),
      profitTotals: {
        revenue: this.money(metrics.profit.revenue),
        grossProfit: this.money(metrics.profit.grossProfit),
        operatingProfit: this.money(metrics.profit.operatingProfit),
        profitBeforeTax: this.money(metrics.profit.profitBeforeTax),
        netProfit: this.money(metrics.profit.netProfit),
        netProfitNegative: metrics.profit.netProfit < 0
      },
      analysisCards: this.buildAnalysisCards(report, metrics),
      alerts: validation.errors.concat(validation.warnings),
      trend: this.buildTrend(month)
    })
  },

  money: function (value) {
    return reportUtils.formatMoneyFromCents(value, false)
  },

  makeRows: function (fields, source) {
    const page = this
    return fields.map(function (field) {
      return { key: field.key, label: field.label, amount: page.money(source[field.key]) }
    })
  },

  buildBalanceGroups: function (report) {
    const metrics = reportUtils.calculateBalance(report.balance)
    return [
      { title: '流动资产', rows: this.makeRows(reportUtils.BALANCE_SECTIONS[0].fields, report.balance), totalLabel: '流动资产合计', total: this.money(metrics.currentAssets) },
      { title: '非流动资产', rows: this.makeRows(reportUtils.BALANCE_SECTIONS[1].fields, report.balance), totalLabel: '非流动资产合计', total: this.money(metrics.nonCurrentAssets) },
      { title: '流动负债', rows: this.makeRows(reportUtils.BALANCE_SECTIONS[2].fields, report.balance), totalLabel: '流动负债合计', total: this.money(metrics.currentLiabilities) },
      { title: '非流动负债', rows: this.makeRows(reportUtils.BALANCE_SECTIONS[3].fields, report.balance), totalLabel: '非流动负债合计', total: this.money(metrics.nonCurrentLiabilities) },
      { title: '所有者权益', rows: this.makeRows(reportUtils.BALANCE_SECTIONS[4].fields, report.balance), totalLabel: '所有者权益合计', total: this.money(metrics.equity) }
    ]
  },

  buildProfitRows: function (report) {
    const profit = reportUtils.calculateProfit(report.profit)
    const rows = []
    reportUtils.PROFIT_SECTIONS.forEach(function (section) {
      section.fields.forEach(function (field) {
        rows.push({ type: 'item', key: field.key, label: field.label, amount: reportUtils.formatMoneyFromCents(report.profit[field.key], false) })
      })
      if (section.key === 'revenue') rows.push({ type: 'subtotal', key: 'revenueTotal', label: '营业收入合计', amount: reportUtils.formatMoneyFromCents(profit.revenue, false) })
      if (section.key === 'cost') rows.push({ type: 'subtotal', key: 'operatingProfit', label: '营业利润', amount: reportUtils.formatMoneyFromCents(profit.operatingProfit, false) })
    })
    return rows
  },

  buildAnalysisCards: function (report, metrics) {
    return [
      { label: '毛利率', value: metrics.profit.grossMargin, desc: '收入扣除主营成本后的盈利水平' },
      { label: '净利率', value: metrics.profit.netMargin, desc: '每100元收入最终形成的净利润' },
      { label: '资产负债率', value: metrics.debtRatio, desc: '负债占资产总额的比例' },
      { label: '流动比率', value: metrics.currentRatio, desc: '流动资产对流动负债的覆盖能力' },
      { label: '应收账款', value: '¥' + this.money(report.balance.accountsReceivable), desc: '客户尚未支付的款项' },
      { label: '货币资金', value: '¥' + this.money(report.balance.cash), desc: '现金和银行存款余额' }
    ]
  },

  buildTrend: function (month) {
    const values = []
    let max = 1
    for (let index = 5; index >= 0; index--) {
      const itemMonth = reportUtils.shiftMonth(month, -index)
      const report = store.getReport(itemMonth)
      const profit = reportUtils.calculateProfit(report.profit)
      max = Math.max(max, Math.abs(profit.revenue), Math.abs(profit.netProfit))
      values.push({ month: itemMonth, revenue: profit.revenue, profit: profit.netProfit })
    }
    return values.map(function (item) {
      return {
        month: item.month,
        label: Number(item.month.split('-')[1]) + '月',
        revenueHeight: item.revenue ? Math.max(Math.abs(item.revenue) / max * 100, 4) + '%' : '0%',
        profitHeight: item.profit ? Math.max(Math.abs(item.profit) / max * 100, 4) + '%' : '0%'
      }
    })
  },

  onSwitchTab: function (event) {
    this.setData({ activeTab: event.currentTarget.dataset.tab })
  },

  changeMonth: function (delta) {
    const next = reportUtils.shiftMonth(this.data.month, delta)
    const company = store.getCompany()
    if (next > reportUtils.currentMonth() || next < company.startMonth) return
    store.setActiveMonth(next)
    this.refresh()
  },

  onPrevMonth: function () {
    if (!this.data.canPrev) return
    this.changeMonth(-1)
  },

  onNextMonth: function () {
    if (!this.data.canNext) return
    this.changeMonth(1)
  },

  onFill: function () {
    wx.switchTab({ url: '/pages/add/add' })
  }
})
