const apiBaseUrl = 'https://wikisource.org/';

const path = require('path');
const fastify = require('fastify')({
  logger: true,
});
fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public'),
});
fastify.register(require('fastify-reply-from'), {
  base: apiBaseUrl,
});

fastify.get('/api.php', (request, reply) => {
  reply.from('/w/api.php');
});

fastify.listen(process.env.PORT || 3000, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`server listening on ${address}`);
});
