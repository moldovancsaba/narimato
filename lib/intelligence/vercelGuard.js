/** Block mutating API routes on Vercel — management runs on localhost operator console. */

function isVercelProduction() {
  return process.env.VERCEL === '1' && process.env.LOCAL_OPERATOR_BYPASS !== '1';
}

function blockVercelMutation(req, res) {
  if (!isVercelProduction()) return false;
  res.status(403).json({
    error:
      'Mutations are disabled on Vercel. Use the local operator console at http://127.0.0.1:10006',
    code: 'LOCAL_OPERATOR_REQUIRED',
  });
  return true;
}

module.exports = {
  isVercelProduction,
  blockVercelMutation,
};
