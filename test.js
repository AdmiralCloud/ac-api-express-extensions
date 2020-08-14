require('chai/register-expect')

const _  = require('lodash')
const acaee = require('./index')

const config = {
  http: {
    apiDoc: {
      apiPrefix: 'v1'
    }
  },
  apiDoc: {
    user: {
      fields: [
        {
          actions: ["find"],
          field: "lastname",
          type: "string",
          description: [
            {
              action: "find",
              message: "Lastname of the user",
            }
          ]
        }
      ]
    }
  }
}

describe('All Params', () => {
  it('Check request parameters', done => {
    let req = {
      query: { id: 1 },
      params: { action: 'user' },
      body: { lastname: 'dooley' }
    }

    acaee.allParams(req, {}, () => {
      const params = req.allParams()
      expect(params.id).to.eql(req.query.id)
      expect(params.action).to.eql(req.params.action)
      expect(params.lastname).to.eql(req.body.lastname)
      return done()
    })
  })
})

describe('Sanitizing', () => {
  it('Check that only lastname is allowed', done => {
    let req = {
      query: { id: 1 },
      params: { action: 'user' },
      body: { lastname: 'dooley' }
    }

    acaee.allParams(req, {}, () => {
      acaee.sanitizer(config, { controller: 'user', action: 'find' }, req, {}, () => {
        const params = req.allParams()
        expect(params).to.eql({ lastname: 'dooley' })
        return done()
      })
    })
  })
})

describe('APIdoc', () => {
  it('Check that apidoc is generated', done => {

    const params = {
      name: 'user', 
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find', name: 'Find user' }] 
    }

    const { apiDocRoute, apiDoc } = acaee.apidocRoute(config, params)
    expect(apiDocRoute.method).to.eql('get')
    expect(apiDocRoute.path).to.eql('/v1/user/apidoc')
    expect(apiDocRoute.action).to.eql('apiDoc')
    expect(apiDocRoute.sanitizer).to.eql(true)
    expect(apiDocRoute.policies).to.eql(true)
    expect(apiDocRoute.apiDoc.enabled).to.eql(false)

    apiDoc({}, (err, result) => {
      if (err) return done(err)
      let doc = _.first(result)
      expect(doc.name).to.eql(params.routes[0].name)
      expect(doc.method).to.eql('get')
      expect(doc.path).to.eql(params.routes[0].path)
     
      const field = _.get(doc, 'request.fields[0]')
      expect(field.field).to.eql('lastname')
      expect(field.type).to.eql('string')
      expect(field.required).to.eql(false)
      expect(field.description).to.eql('Lastname of the user')
      expect(field.location).to.eql('body')
      return done()
    })
  })
})