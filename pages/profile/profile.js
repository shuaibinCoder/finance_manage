const repository = require('../../repositories/report-repository')

Page({
  data: {
    company: {},
    companyInitial: '财',
    reportCount: 0,
    confirmedCount: 0,
    draftCount: 0,
    cloudMode: 'cloud',
    cloudModeText: '云端模式',
    cloudEnvId: '',
    cloudError: '',
    checkingCloud: false
  },

  onShow: async function () {
    try {
      const company = await repository.getCompany()
      if (!company) {
        wx.redirectTo({ url: '/pages/setup/setup' })
        return
      }
      const reports = await repository.listReports()
      this.updateCloudStatus()
      this.setData({
        company: company,
        companyInitial: String(company.name || '财').slice(0, 1),
        reportCount: reports.length,
        confirmedCount: reports.filter(function (item) { return item.status === 'confirmed' }).length,
        draftCount: reports.filter(function (item) { return item.status !== 'confirmed' }).length
      })
    } catch (error) {
      this.updateCloudStatus()
      wx.showToast({ title: error.message || '数据加载失败', icon: 'none' })
    }
  },

  updateCloudStatus: function () {
    const status = repository.getStatus()
    this.setData({
      cloudMode: status.mode,
      cloudModeText: status.mode === 'cloud' ? '云端已连接' : '本地兜底模式',
      cloudEnvId: status.envId,
      cloudError: status.lastError || ''
    })
  },

  onCheckCloud: async function () {
    if (this.data.checkingCloud) return
    this.setData({ checkingCloud: true })
    try {
      await repository.checkCloud()
      this.updateCloudStatus()
      wx.showToast({ title: '云端环境可用', icon: 'success' })
    } catch (error) {
      this.updateCloudStatus()
      wx.showModal({
        title: '云端连接失败',
        content: error.message || '请检查环境ID、环境状态和云函数是否已部署。',
        showCancel: false
      })
    } finally {
      this.setData({ checkingCloud: false })
    }
  },

  onEditCompany: function () {
    wx.navigateTo({ url: '/pages/setup/setup?mode=edit' })
  },

  onLoadDemo: function () {
    const page = this
    wx.showModal({
      title: '加载演示数据',
      content: '将生成近六个月演示财务数据，便于查看完整报表效果。现有同月份数据会被覆盖。',
      confirmText: '加载数据',
      success: async function (result) {
        if (!result.confirm) return
        try {
          await repository.seedDemoData()
          await page.onShow()
          wx.showToast({ title: '演示数据已生成', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: error.message || '生成失败', icon: 'none' })
        }
      }
    })
  },

  onExport: async function () {
    try {
      const data = await repository.exportData()
      wx.setClipboardData({
        data: data,
        success: function () { wx.showToast({ title: '备份数据已复制', icon: 'success' }) },
        fail: function () { wx.showToast({ title: '复制失败', icon: 'none' }) }
      })
    } catch (error) {
      wx.showToast({ title: error.message || '导出失败', icon: 'none' })
    }
  },

  onClearReports: function () {
    const page = this
    wx.showModal({
      title: '清空月报数据',
      content: '将删除全部月份的填报和报表，企业资料会保留。此操作无法撤销。',
      confirmText: '确认清空',
      confirmColor: '#d9485f',
      success: async function (result) {
        if (!result.confirm) return
        try {
          await repository.clearReports()
          await page.onShow()
          wx.showToast({ title: '月报已清空', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: error.message || '清空失败', icon: 'none' })
        }
      }
    })
  },

  onResetApp: function () {
    wx.showModal({
      title: '重置应用',
      content: '将删除企业资料和全部月报数据，并返回初始化页面。此操作无法撤销。',
      confirmText: '确认重置',
      confirmColor: '#d9485f',
      success: async function (result) {
        if (!result.confirm) return
        try {
          await repository.clearAll()
          wx.reLaunch({ url: '/pages/setup/setup' })
        } catch (error) {
          wx.showToast({ title: error.message || '重置失败', icon: 'none' })
        }
      }
    })
  }
})
