const config = require('./config.json');

const fastify = require('fastify')({
  logger: true,
});

fastify
  .register(require('fastify-cookie'))
  .register(require('fastify-session'))
  .register(require('fastify-oauth2'), {
    name: 'wikisourceOAuth2',
    credentials: {
      client: {
        id: config.consumerKey,
        secret: config.consumerSecret
      },
      auth: {
        authorizeHost: config.apiBaseUrl,
        authorizePath: '/w/rest.php/oauth2/authorize',
        tokenHost: config.apiBaseUrl,
        tokenPath: '/w/rest.php/oauth2/access_token'
      }
    },
    callbackUri: 'http://localhost:3000/callback'
  })
  .register(require('fastify-static'), {
    root: `${__dirname}/public`,
  });

fastify.get('/callback', async function (req, reply) {
  const token = await this.wikisourceOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
  reply.send({ access_token: token.access_token });
});

fastify.listen(process.env.PORT || 3000, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`server listening on ${address}`);
});
