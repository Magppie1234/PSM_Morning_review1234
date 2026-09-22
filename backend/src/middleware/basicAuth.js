import crypto from 'crypto';

// Optional sign-in for the whole dashboard (API and pages) using HTTP Basic auth: the browser shows its own
// username / password prompt. Turned on by setting DASHBOARD_USER and DASHBOARD_PASSWORD.
const same = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export function basicAuth({ user, password }) {
  return (request, response, next) => {
    if (request.path === '/api/health') return next(); // lets the host check the server is up
    const [scheme, encoded] = String(request.headers.authorization ?? '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const [givenUser, ...rest] = Buffer.from(encoded, 'base64').toString('utf-8').split(':');
      if (same(givenUser, user) && same(rest.join(':'), password)) return next();
    }
    response.set('WWW-Authenticate', 'Basic realm="Magppie Morning Review", charset="UTF-8"');
    return response.status(401).send('Sign-in required.');
  };
}
