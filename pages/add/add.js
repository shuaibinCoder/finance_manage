const store = require('../../utils/store')
const reportUtils = require('../../utils/report')

Page({
  data: {
    month: '',
    monthLabel: '',
    canPrev: true,
    canNext: false,
    status: 'draft',
    statusText: '填写中',
    readonly: false,
    balanceSections: [],
    profitSections: [],
    totals: {},
    errors: [],
    warnings: [],
    saving: false
  },

  onLoad: function () {
    this.report = null
    this.dirty = false
  },

  onShow: function () {
    if (!store.getCompany()) {
      wx.redirectTo({ url: '/pages/setup/setup' })
      return
    }
    this.loadMonth(store.getActiveMonth())
  },

  onHide: function () {
    this.saveDraftSilently()
  },

  onUnload: function () {
    this.saveDraftSilently()
  },

  loadMonth: function (month) {
    this.report = store.getReport(month)
    this.dirty = false
    const company = store.getCompany()
    const validation = reportUtils.validateReport(this.report)
    this.setData({
      month: month,
      monthLabel: reportUtils.monthLabel(month),
      canPrev: month > company.startMonth,
      canNext: month < reportUtils.currentMonth(),
      status: this.report.status,
      statusText: this.report.status === 'confirmed' ? '已确认' : (store.hasReport(month) ? '填写中' : '未填报'),
      readonly: this.report.status === 'confirmed',
      balanceSections: reportUtils.buildInputSections(reportUtils.BALANCE_SECTIONS, this.report.balance),
      profitSections: reportUtils.buildInputSections(reportUtils.PROFIT_SECTIONS, this.report.profit),
      totals: this.formatTotals(validation.metrics),
      errors: store.hasReport(month) ? validation.errors : [],
      warnings: store.hasReport(month) ? validation.warnings : []
    })
  },

  formatTotals: function (metrics) {
    return {
      assets: reportUtils.formatMoneyFromCents(metrics.balance.assets, false),
      liabilitiesAndEquity: reportUtils.formatMoneyFromCents(metrics.balance.liabilitiesAndEquity, false),
      difference: reportUtils.formatMoneyFromCents(Math.abs(metrics.balance.difference), false),
      balanced: metrics.balance.difference === 0,
      revenue: reportUtils.formatMoneyFromCents(metrics.profit.revenue, false),
      netProfit: reportUtils.formatMoneyFromCents(metrics.profit.netProfit, false),
      grossMargin: metrics.profit.grossMargin,
      netMargin: metrics.profit.netMargin,
      netProfitNegative: metrics.profit.netProfit < 0
    }
  },

  onAmountInput: function (event) {
    if (!this.report || this.data.readonly) return
    const group = event.currentTarget.dataset.group
    const key = event.currentTarget.dataset.key
    if (!this.report[group] || !Object.prototype.hasOwnProperty.call(this.report[group], key)) return
    this.report[group][key] = reportUtils.parseMoneyToCents(event.detail.value)
    this.dirty = true
    const validation = reportUtils.validateReport(this.report)
    this.setData({
      totals: this.formatTotals(validation.metrics),
      errors: validation.errors,
      warnings: validation.warnings
    })
  },

  saveDraftSilently: function () {
    if (!this.report || this.report.status === 'confirmed' || !this.dirty) return
    try {
      this.report = store.saveReport(this.report)
      this.dirty = false
    } catch (error) {}
  },

  onSave: function () {
    if (this.data.readonly || this.data.saving) return
    this.setData({ saving: true })
    try {
      this.report = store.saveReport(this.report)
      this.dirty = false
      this.setData({ saving: false, statusText: '填写中' })
      wx.showToast({ title: '草稿已保存', icon: 'success' })
    } catch (error) {
      this.setData({ saving: false })
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  onConfirm: function () {
    if (this.data.readonly) return
    this.report = store.saveReport(this.report)
    this.dirty = false
    const result = store.confirmReport(this.data.month)
    if (!result.success) {
      this.setData({ errors: result.validation.errors, warnings: result.validation.warnings })
      wx.showModal({
        title: '暂时无法确认',
        content: result.validation.errors.join('\n'),
        showCancel: false,
        confirmText: '返回修改'
      })
      return
    }
    this.report = result.report
    this.loadMonth(this.data.month)
    wx.showToast({ title: '月报已确认', icon: 'success' })
  },

  onReopen: function () {
    const page = this
    wx.showModal({
      title: '撤销确认',
      content: '撤销后可以修改本月数据，修改完成后需要重新确认。',
      confirmText: '撤销确认',
      success: function (result) {
        if (!result.confirm) return
        page.report = store.reopenReport(page.data.month)
        page.loadMonth(page.data.month)
      }
    })
  },

  onCopyPrevious: function () {
    if (this.data.readonly) return
    const previousMonth = reportUtils.shiftMonth(this.data.month, -1)
    if (!store.hasReport(previousMonth)) {
      wx.showToast({ title: '上月暂无可复制数据', icon: 'none' })
      return
    }
    const page = this
    wx.showModal({
      title: '复制上月数据',
      content: '将使用' + reportUtils.monthLabel(previousMonth) + '的数据覆盖当前填写内容。',
      confirmText: '确认复制',
      success: function (result) {
        if (!result.confirm) return
        const copied = store.copyPreviousMonth(page.data.month)
        if (!copied) {
          wx.showToast({ title: '复制失败', icon: 'none' })
          return
        }
        page.loadMonth(page.data.month)
        wx.showToast({ title: '已复制上月数据', icon: 'success' })
      }
    })
  },

  changeMonth: function (delta) {
    this.saveDraftSilently()
    const next = reportUtils.shiftMonth(this.data.month, delta)
    const company = store.getCompany()
    if (next > reportUtils.currentMonth() || next < company.startMonth) return
    store.setActiveMonth(next)
    this.loadMonth(next)
  },

  onPrevMonth: function () {
    if (!this.data.canPrev) return
    this.changeMonth(-1)
  },

  onNextMonth: function () {
    if (!this.data.canNext) return
    this.changeMonth(1)
  },

  onViewReports: function () {
    wx.switchTab({ url: '/pages/stats/stats' })
  }
})
