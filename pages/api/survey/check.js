import {
  orgRequiresSurveyPassword,
  getSurveyAccess,
} from '../../../lib/system/surveyAccess';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { organizationId } = req.query;
  if (!organizationId) {
    return res.status(400).json({ error: 'organizationId required' });
  }

  try {
    const required = await orgRequiresSurveyPassword(organizationId);
    const access = getSurveyAccess(req, organizationId);
    return res.status(200).json({
      required,
      unlocked: !required || !!access,
    });
  } catch (err) {
    console.error('Survey check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
