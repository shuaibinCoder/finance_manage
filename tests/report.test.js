let storage = {}

global.wx = {
  getStorageSync: function (key) { return storage[key] },
  setStorageSync: function (key, value) { storage[key] = JSON.parse(JSON.stringify(value)) },
  removeStorageSync: function (key) { delete storage[key] }
}

const reportUtils = require('../utils/report')
const store = require('../utils/store')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(reportUtils.parseMoneyToCents('1,234.56') === 123456, '金额应转换为整数分')
assert(reportUtils.formatMoneyFromCents(-123456, false) === '-1,234.56', '金额格式化错误')
assert(reportUtils.shiftMonth('2026-01', -1) === '2025-12', '跨年月份计算错误')

store.setCompany({ name: '测试公司', industry: '商贸零售', startMonth: '2026-01' })
const report = reportUtils.createEmptyReport('2026-10')
report.balance.cash = 1000000
report.balance.paidInCapital = 1000000
report.profit.mainRevenue = 500000
report.profit.mainCost = 300000
report.profit.adminExpenses = 50000
store.saveReport(report)

const validation = reportUtils.validateReport(store.getReport('2026-10'))
assert(validation.valid, '平衡的月报应通过校验')
assert(validation.metrics.profit.netProfit === 150000, '净利润计算错误')
assert(store.submitReport('2026-10').success, '月报提交失败')
assert(store.getReport('2026-10').status === 'pending_confirmation', '待确认状态错误')
assert(store.confirmReport('2026-10').success, '月报确认失败')
assert(store.getReport('2026-10').status === 'confirmed', '月报状态错误')

store.seedDemoData()
const reports = store.listReports().slice(0, 6)
assert(reports.length === 6, '演示数据应生成六个月')
reports.forEach(function (item) {
  assert(reportUtils.calculateBalance(item.balance).difference === 0, item.month + '资产负债表不平衡')
})

console.log('report.test.js: all tests passed')
