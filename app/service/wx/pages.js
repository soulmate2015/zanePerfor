'use strict'

const Service = require('egg').Service

class PagesService extends Service {
  // 获得页面性能数据平均值
  async getAveragePageList (ctx) {
    const query = ctx.request.query
    const appId = query.appId
    let pageNo = query.pageNo || 1
    let pageSize = query.pageSize || this.app.config.pageSize
    const beginTime = query.beginTime
    const endTime = query.endTime
    const url = query.url
    const city = query.city
    const isCity = query.isCity
    const isBrand = query.isBrand
    const isSystem = query.isSystem
    const isModel = query.isModel
    const isNet = query.isNet

    pageNo = pageNo * 1
    pageSize = pageSize * 1

    // 查询参数拼接
    const queryjson = { $match: { } }
    if (url) queryjson.$match.path = { $regex: new RegExp(url, 'i') }
    if (city) queryjson.$match.city = city
    if (beginTime && endTime) queryjson.$match.create_time = { $gte: new Date(beginTime), $lte: new Date(endTime) }

    const group_id = {
      url: '$path',
      city: `${isCity === 'true' ? '$city' : ''}`,
      brand: `${isBrand === 'true' ? '$brand' : ''}`,
      system: `${isSystem === 'true' ? '$system' : ''}`,
      model: `${isModel === 'true' ? '$model' : ''}`,
      net: `${isNet === 'true' ? '$net' : ''}`
    }

    return (url || city) ? await this.oneThread(appId, queryjson, pageNo, pageSize, group_id)
      : await this.moreThread(appId, beginTime, endTime, queryjson, pageNo, pageSize, group_id)
  }

  // 获得多个页面的平均性能数据
  async moreThread (appId, beginTime, endTime, queryjson, pageNo, pageSize, group_id) {
    const result = []
    let distinct = await this.app.models.WxPages(appId).distinct('path', queryjson.$match).read('sp')
      .exec() || []
    const copdistinct = distinct

    const betinIndex = (pageNo - 1) * pageSize
    if (distinct && distinct.length) {
      distinct = distinct.slice(betinIndex, betinIndex + pageSize)
    }
    const resolvelist = []
    for (let i = 0, len = distinct.length; i < len; i++) {
      queryjson.$match.path = distinct[i]
      resolvelist.push(
        Promise.resolve(
          this.app.models.WxPages(appId).aggregate([
            { $match: { path: distinct[i], create_time: { $gte: new Date(beginTime), $lte: new Date(endTime) } } },
            {
              $group: {
                _id: group_id,
                count: { $sum: 1 }
              }
            }
          ]).read('sp')
            .exec()
        )
      )
    }
    const all = await Promise.all(resolvelist) || []
    all.forEach(item => {
      result.push(item[0])
    })
    /* eslint-disable */
        result.sort(function (obj1, obj2) {
            let val1 = obj1.count;
            let val2 = obj2.count;
            if (val1 < val2) {
                return 1;
            } else if (val1 > val2) {
                return -1;
            } else {
                return 0;
            }
        });
        /* eslint-enable */

    return {
      datalist: result,
      totalNum: copdistinct.length,
      pageNo
    }
  }

  // 单个页面查询平均信息
  async oneThread (appId, queryjson, pageNo, pageSize, group_id) {
    const count = Promise.resolve(this.app.models.WxPages(appId).distinct('path', queryjson.$match).read('sp')
      .exec())
    const datas = Promise.resolve(
      this.app.models.WxPages(appId).aggregate([
        queryjson,
        {
          $group: {
            _id: group_id,
            count: { $sum: 1 }
          }
        },
        { $skip: (pageNo - 1) * pageSize },
        { $sort: { count: -1 } },
        { $limit: pageSize }
      ]).read('sp')
        .exec()
    )
    const all = await Promise.all([count, datas])
    const [totalNum, datalist] = all

    return {
      datalist,
      totalNum: totalNum.length,
      pageNo
    }
  }

  // 单个页面性能数据列表
  async getOnePageList (ctx) {
    const query = ctx.request.query
    const appId = query.appId
    let pageNo = query.pageNo || 1
    let pageSize = query.pageSize || this.app.config.pageSize
    const beginTime = query.beginTime
    const endTime = query.endTime
    const url = query.url

    pageNo = pageNo * 1
    pageSize = pageSize * 1

    // 查询参数拼接
    const queryjson = { $match: { path: url } }

    if (beginTime && endTime) queryjson.$match.create_time = { $gte: new Date(beginTime), $lte: new Date(endTime) }

    const count = Promise.resolve(this.app.models.WxPages(appId).count(queryjson.$match).read('sp')
      .exec())
    const datas = Promise.resolve(
      this.app.models.WxPages(appId).aggregate([
        queryjson,
        { $sort: { create_time: -1 } },
        { $skip: ((pageNo - 1) * pageSize) },
        { $limit: pageSize }
      ]).read('sp')
        .exec()
    )
    const all = await Promise.all([count, datas])
    const [totalNum, datalist] = all

    return {
      datalist,
      totalNum,
      pageNo
    }
  }

  // 单个页面详情
  async getPageDetails (appId, field, type) {
    const query = { }
    type === 1 ? query._id = field : query.mark_page = field
    return await this.app.models.WxPages(appId).findOne(query).read('sp')
      .exec()
  }

  // 获得页面性能数据平均值
  async getDataGroupBy (type, url, appId, beginTime, endTime) {
    type = type * 1

    const queryjson = { $match: { path: url } }
    if (beginTime && endTime) queryjson.$match.create_time = { $gte: new Date(beginTime), $lte: new Date(endTime) }
    const group_id = {
      url: '$path',
      city: `${type === 1 ? '$city' : ''}`,
      brand: `${type === 2 ? '$brand' : ''}`,
      system: `${type === 3 ? '$system' : ''}`
    }

    const datas = await this.app.models.WxPages(appId).aggregate([
      queryjson,
      {
        $group: {
          _id: group_id,
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).read('sp')
      .exec()

    return datas
  }
}

module.exports = PagesService
