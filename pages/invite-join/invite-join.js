const repository = require('../../repositories/report-repository')

Page({
  data: {
    token: '',
    invite: null,
    user: null,
    loading: true,
    joining: false,
    error: ''
  },

  onLoad: async function (options) {
    const token = decodeURIComponent(options && options.token || '')
    this.setData({ token: token })
    try {
      const results = await Promise.all([repository.getInvitePreview(token), repository.getSession()])
      this.setData({ invite: results[0], user: results[1].user, loading: false })
    } catch (error) {
      this.setData({ error: error.message || '邀请链接无效', loading: false })
    }
  },

  onJoin: async function () {
    if (this.data.joining) return
    this.setData({ joining: true })
    try {
      const session = await repository.acceptInvite(this.data.token)
      wx.showToast({ title: '已加入企业', icon: 'success' })
      setTimeout(function () {
        if (session.user && !session.user.profileCompleted) {
          wx.redirectTo({ url: '/pages/user-profile/user-profile?next=home' })
        } else {
          wx.switchTab({ url: '/pages/index/index' })
        }
      }, 500)
    } catch (error) {
      this.setData({ joining: false, error: error.message || '加入企业失败' })
    }
  },

  onHome: function () {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
