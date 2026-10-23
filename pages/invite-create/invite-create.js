const repository = require('../../repositories/report-repository')

Page({
  data: {
    roles: [
      { value: 'finance', label: '财务人员', desc: '填写、修改并提交月报' },
      { value: 'boss', label: '老板', desc: '查看、退回和确认月报' },
      { value: 'viewer', label: '查看者', desc: '只读查看企业财务数据' }
    ],
    selectedRole: 'finance',
    validOptions: [
      { value: 24, label: '24小时' },
      { value: 168, label: '7天' }
    ],
    validIndex: 1,
    invite: null,
    creating: false
  },

  onSelectRole: function (event) {
    this.setData({ selectedRole: event.currentTarget.dataset.role, invite: null })
  },

  onValidChange: function (event) {
    this.setData({ validIndex: Number(event.detail.value), invite: null })
  },

  onCreate: async function () {
    if (this.data.creating) return
    this.setData({ creating: true })
    try {
      const option = this.data.validOptions[this.data.validIndex]
      const invite = await repository.createInvite(this.data.selectedRole, option.value)
      invite.expiresText = new Date(invite.expiresAt).toLocaleString()
      this.setData({ invite: invite })
      wx.showToast({ title: '邀请已生成', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '生成邀请失败', icon: 'none' })
    } finally {
      this.setData({ creating: false })
    }
  },

  onShareAppMessage: function () {
    const invite = this.data.invite
    if (!invite) {
      return { title: '邀请你使用小微财报', path: '/pages/index/index' }
    }
    return {
      title: '邀请你以“' + invite.roleLabel + '”加入' + invite.companyName,
      path: '/pages/invite-join/invite-join?token=' + encodeURIComponent(invite.token)
    }
  }
})
