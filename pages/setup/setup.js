const repository = require('../../repositories/report-repository')
const reportUtils = require('../../utils/report')

Page({
  data: {
    mode: 'create',
    name: '',
    industries: ['商贸零售', '生活服务', '科技互联网', '生产制造', '建筑工程', '其他行业'],
    industryIndex: 0,
    startMonth: '',
    maxMonth: '',
    saving: false
  },

  onLoad: async function (options) {
    const company = await repository.getCompany()
    const mode = options && options.mode === 'edit' ? 'edit' : 'create'
    let industryIndex = 0
    if (company && company.industry) {
      const found = this.data.industries.indexOf(company.industry)
      industryIndex = found >= 0 ? found : 0
    }
    this.setData({
      mode: mode,
      name: company ? company.name : '',
      industryIndex: industryIndex,
      startMonth: company && company.startMonth ? company.startMonth : reportUtils.currentMonth(),
      maxMonth: reportUtils.currentMonth()
    })
  },

  onNameInput: function (event) {
    this.setData({ name: event.detail.value })
  },

  onIndustryChange: function (event) {
    this.setData({ industryIndex: Number(event.detail.value) })
  },

  onMonthChange: function (event) {
    this.setData({ startMonth: event.detail.value })
  },

  onSave: async function () {
    if (this.data.saving) return
    const name = String(this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入企业名称', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await repository.saveCompany({
        name: name,
        industry: this.data.industries[this.data.industryIndex],
        startMonth: this.data.startMonth
      })
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(function () {
        const pages = getCurrentPages()
        if (pages.length > 1) wx.navigateBack()
        else wx.switchTab({ url: '/pages/index/index' })
      }, 400)
    } catch (error) {
      this.setData({ saving: false })
      wx.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
    }
  }
})
