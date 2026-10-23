const repository = require('../../repositories/report-repository')
const reportUtils = require('../../utils/report')

Page({
  data: {
    companyName: '',
    month: '',
    monthLabel: '',
    canPrev: true,
    canNext: false,
    status: 'draft',
    statusText: '填写中',
    hasData: false,
    metrics: {},
    warningList: [],
    trend: [],
    loading: true
  },

  onShow: async function () {
    this.setData({ loading: true })
    try {
      const company = await repository.getCompany()
      if (!company) {
        wx.redirectTo({ url: '/pages/setup/setup' })
        return
      }
      this.company = company
      await this.refresh()
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '数据加载失败', icon: 'none' })
    }
  },

  refresh: async function () {
    const company = this.company || await repository.getCompany()
    const month = repository.getActiveMonth() || reportUtils.currentMonth()
    const results = await Promise.all([
      repository.getReport(month),
      repository.listReports()
    ])
    const report = results[0]
    const reports = results[1]
    const validation = reportUtils.validateReport(report)
    const metrics = validation.metrics
    const hasData = Boolean(report._exists)

    this.setData({
      companyName: company.name,
      month: month,
      monthLabel: reportUtils.monthLabel(month),
      canPrev: month > company.startMonth,
      canNext: month < reportUtils.currentMonth(),
      status: report.status,
      statusText: report.status === 'confirmed' ? '已确认' : (hasData ? '填写中' : '未填报'),
      hasData: hasData,
      metrics: {
        revenue: reportUtils.formatMoneyFromCents(metrics.profit.revenue, false),
        netProfit: reportUtils.formatMoneyFromCents(metrics.profit.netProfit, false),
        cash: reportUtils.formatMoneyFromCents(report.balance.cash, false),
        receivable: reportUtils.formatMoneyFromCents(report.balance.accountsReceivable, false),
        inventory: reportUtils.formatMoneyFromCents(report.balance.inventory, false),
        liabilities: reportUtils.formatMoneyFromCents(metrics.balance.liabilities, false),
        grossMargin: metrics.profit.grossMargin,
        netMargin: metrics.profit.netMargin,
        debtRatio: metrics.debtRatio
      },
      warningList: hasData ? validation.errors.concat(validation.warnings).slice(0, 3) : [],
      trend: this.buildTrend(month, reports),
      loading: false
    })
  },

  buildTrend: function (month, reports) {
    const reportMap = {}
    ;(reports || []).forEach(function (report) { reportMap[report.month] = report })
    const raw = []
    let max = 1
    for (let index = 5; index >= 0; index--) {
      const itemMonth = reportUtils.shiftMonth(month, -index)
      const report = reportMap[itemMonth] || reportUtils.createEmptyReport(itemMonth)
      const profit = reportUtils.calculateProfit(report.profit)
      max = Math.max(max, Math.abs(profit.revenue), Math.abs(profit.netProfit))
      raw.push({ month: itemMonth, revenue: profit.revenue, netProfit: profit.netProfit })
    }
    return raw.map(function (item) {
      return {
        month: item.month,
        label: Number(item.month.split('-')[1]) + '月',
        revenueText: reportUtils.formatCompactMoney(item.revenue),
        profitText: reportUtils.formatCompactMoney(item.netProfit),
        revenueHeight: item.revenue ? Math.max(Math.abs(item.revenue) / max * 100, 4) + '%' : '0%',
        profitHeight: item.netProfit ? Math.max(Math.abs(item.netProfit) / max * 100, 4) + '%' : '0%'
      }
    })
  },

  changeMonth: async function (delta) {
    const next = reportUtils.shiftMonth(this.data.month, delta)
    const company = this.company
    if (next > reportUtils.currentMonth() || next < company.startMonth) return
    repository.setActiveMonth(next)
    await this.refresh()
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
  },

  onReports: function () {
    wx.switchTab({ url: '/pages/stats/stats' })
  }
})
