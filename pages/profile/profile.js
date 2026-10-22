const store = require('../../utils/store')

Page({
  data: {
    company: {},
    companyInitial: '财',
    reportCount: 0,
    confirmedCount: 0,
    draftCount: 0
  },

  onShow: function () {
    const company = store.getCompany()
    if (!company) {
      wx.redirectTo({ url: '/pages/setup/setup' })
      return
    }
    const reports = store.listReports()
    this.setData({
      company: company,
      companyInitial: String(company.name || '财').slice(0, 1),
      reportCount: reports.length,
      confirmedCount: reports.filter(function (item) { return item.status === 'confirmed' }).length,
      draftCount: reports.filter(function (item) { return item.status !== 'confirmed' }).length
    })
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
      success: function (result) {
        if (!result.confirm) return
        store.seedDemoData()
        page.onShow()
        wx.showToast({ title: '演示数据已生成', icon: 'success' })
      }
    })
  },

  onExport: function () {
    const data = store.exportData()
    wx.setClipboardData({
      data: data,
      success: function () {
        wx.showToast({ title: '备份数据已复制', icon: 'success' })
      },
      fail: function () {
        wx.showToast({ title: '复制失败', icon: 'none' })
      }
    })
  },

  onClearReports: function () {
    const page = this
    wx.showModal({
      title: '清空月报数据',
      content: '将删除全部月份的填报和报表，企业资料会保留。此操作无法撤销。',
      confirmText: '确认清空',
      confirmColor: '#d9485f',
      success: function (result) {
        if (!result.confirm) return
        store.clearReports()
        page.onShow()
        wx.showToast({ title: '月报已清空', icon: 'success' })
      }
    })
  },

  onResetApp: function () {
    wx.showModal({
      title: '重置应用',
      content: '将删除企业资料和全部月报数据，并返回初始化页面。此操作无法撤销。',
      confirmText: '确认重置',
      confirmColor: '#d9485f',
      success: function (result) {
        if (!result.confirm) return
        store.clearAll()
        wx.reLaunch({ url: '/pages/setup/setup' })
      }
    })
  }
})
