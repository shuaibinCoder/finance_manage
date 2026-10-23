let storage = {}

global.wx = {
  getStorageSync: function (key) { return storage[key] },
  setStorageSync: function (key, value) { storage[key] = JSON.parse(JSON.stringify(value)) },
  removeStorageSync: function (key) { delete storage[key] },
  cloud: {
    callFunction: function () {
      return Promise.reject(new Error('environment unavailable'))
    }
  }
}

const local = require('../utils/store')
const repository = require('../repositories/report-repository')
const reportUtils = require('../utils/report')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

;(async function () {
  local.setCompany({ name: '本地兜底公司', industry: '商贸零售', startMonth: '2026-01' })
  const company = await repository.getCompany()
  assert(company.name === '本地兜底公司', '云端失败后应返回本地企业')
  assert(repository.getStatus().mode === 'local-fallback', '应进入本地兜底模式')

  const report = reportUtils.createEmptyReport('2026-10')
  report.balance.cash = 100000
  report.balance.paidInCapital = 100000
  const saved = await repository.saveReport(report)
  assert(saved._exists === true, '本地兜底保存后应标记为已存在')

  const fetched = await repository.getReport('2026-10')
  assert(fetched.balance.cash === 100000, '本地兜底数据读取失败')
  console.log('repository.test.js: all tests passed')
})().catch(function (error) {
  console.error(error)
  process.exit(1)
})
