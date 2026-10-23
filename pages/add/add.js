const repository = require('../../repositories/report-repository')
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
    saving: false,
    loading: true
  },

  onLoad: function () {
    this.report = null
    this.company = null
    this.dirty = false
  },

  onShow: async function () {
    try {
      this.company = await repository.getCompany()
      if (!this.company) {
        wx.redirectTo({ url: '/pages/setup/setup' })
        return
      }
      await this.loadMonth(repository.getActiveMonth())
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '数据加载失败', icon: 'none' })
    }
  },

  onHide: function () {
    this.saveDraftSilently()
  },

  onUnload: function () {
    this.saveDraftSilently()
  },

  loadMonth: async function (month) {
    this.setData({ loading: true })
    this.report = await repository.getReport(month)
    this.dirty = false
    const validation = reportUtils.validateReport(this.report)
    const hasData = Boolean(this.report._exists)
    this.setData({
      month: month,
      monthLabel: reportUtils.monthLabel(month),
      canPrev: month > this.company.startMonth,
      canNext: month < reportUtils.currentMonth(),
      status: this.report.status,
      statusText: this.report.status === 'confirmed' ? '已确认' : (hasData ? '填写中' : '未填报'),
      readonly: this.report.status === 'confirmed',
      balanceSections: reportUtils.buildInputSections(reportUtils.BALANCE_SECTIONS, this.report.balance),
      profitSections: reportUtils.buildInputSections(reportUtils.PROFIT_SECTIONS, this.report.profit),
      totals: this.formatTotals(validation.metrics),
      errors: hasData ? validation.errors : [],
      warnings: hasData ? validation.warnings : [],
      loading: false
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

  saveDraftSilently: async function () {
    if (!this.report || this.report.status === 'confirmed' || !this.dirty) return
    try {
      this.report = await repository.saveReport(this.report)
      this.dirty = false
    } catch (error) {}
  },

  onSave: async function () {
    if (this.data.readonly || this.data.saving) return
    this.setData({ saving: true })
    try {
      this.report = await repository.saveReport(this.report)
      this.dirty = false
      this.setData({ saving: false, statusText: '填写中' })
      wx.showToast({ title: '草稿已保存', icon: 'success' })
    } catch (error) {
      this.setData({ saving: false })
      wx.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
    }
  },

  onConfirm: async function () {
    if (this.data.readonly || this.data.saving) return
    this.setData({ saving: true })
    try {
      if (this.dirty || !this.report._exists) {
        this.report = await repository.saveReport(this.report)
        this.dirty = false
      }
      const result = await repository.confirmReport(this.data.month, this.report.version)
      if (!result.success) {
        this.setData({ saving: false, errors: result.validation.errors, warnings: result.validation.warnings })
        wx.showModal({
          title: '暂时无法确认',
          content: result.validation.errors.join('\n'),
          showCancel: false,
          confirmText: '返回修改'
        })
        return
      }
      this.report = result.report
      await this.loadMonth(this.data.month)
      this.setData({ saving: false })
      wx.showToast({ title: '月报已确认', icon: 'success' })
    } catch (error) {
      this.setData({ saving: false })
      wx.showToast({ title: error.message || '确认失败，请重试', icon: 'none' })
    }
  },

  onReopen: function () {
    const page = this
    wx.showModal({
      title: '撤销确认',
      content: '撤销后可以修改本月数据，修改完成后需要重新确认。',
      confirmText: '撤销确认',
      success: async function (result) {
        if (!result.confirm) return
        try {
          page.report = await repository.reopenReport(page.data.month, page.report.version)
          await page.loadMonth(page.data.month)
        } catch (error) {
          wx.showToast({ title: error.message || '撤销失败', icon: 'none' })
        }
      }
    })
  },

  onCopyPrevious: function () {
    if (this.data.readonly) return
    const previousMonth = reportUtils.shiftMonth(this.data.month, -1)
    const page = this
    wx.showModal({
      title: '复制上月数据',
      content: '将使用' + reportUtils.monthLabel(previousMonth) + '的数据覆盖当前填写内容。',
      confirmText: '确认复制',
      success: async function (result) {
        if (!result.confirm) return
        try {
          page.report = await repository.copyPreviousMonth(page.data.month)
          await page.loadMonth(page.data.month)
          wx.showToast({ title: '已复制上月数据', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: error.message || '上月暂无可复制数据', icon: 'none' })
        }
      }
    })
  },

  changeMonth: async function (delta) {
    await this.saveDraftSilently()
    const next = reportUtils.shiftMonth(this.data.month, delta)
    if (next > reportUtils.currentMonth() || next < this.company.startMonth) return
    repository.setActiveMonth(next)
    await this.loadMonth(next)
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
