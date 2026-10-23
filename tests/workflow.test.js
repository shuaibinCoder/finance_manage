let storage = {}

global.wx = {
  getStorageSync: function (key) { return storage[key] },
  setStorageSync: function (key, value) { storage[key] = JSON.parse(JSON.stringify(value)) },
  removeStorageSync: function (key) { delete storage[key] }
}

const store = require('../utils/store')
const reportUtils = require('../utils/report')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

store.setCompany({ name: '协作测试公司', industry: '商贸零售', startMonth: '2026-01' })
store.saveUserProfile({ displayName: '李会计', avatarFileId: '' })
const session = store.getSession()
assert(session.membership.role === 'owner', '本地兜底应提供管理员身份')
assert(session.user.displayName === '李会计', '成员资料保存失败')

let report = reportUtils.createEmptyReport('2026-10')
report.balance.cash = 100000
report.balance.paidInCapital = 100000
store.saveReport(report)

let result = store.submitReport('2026-10')
assert(result.success, '月报提交失败')
assert(store.getReport('2026-10').status === 'pending_confirmation', '提交后应待确认')

store.returnReport('2026-10', '请补充费用说明')
assert(store.getReport('2026-10').status === 'returned', '退回状态错误')
assert(store.getReport('2026-10').returnReason === '请补充费用说明', '退回原因错误')

result = store.submitReport('2026-10')
assert(result.success, '退回后重新提交失败')
result = store.confirmReport('2026-10')
assert(result.success, '老板确认失败')
assert(store.getReport('2026-10').status === 'confirmed', '确认状态错误')

console.log('workflow.test.js: all tests passed')
