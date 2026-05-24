import { connectMaster, getMasterOrganizationModel } from '../../../lib/db';
import {
  findOrganizationIdByPassword,
  setSurveyAccessCookie,
} from '../../../lib/system/surveyAccess';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  if (!password?.trim()) {
    return res.status(400).json({ error: 'Password required' });
  }

  try {
    const organizationId = await findOrganizationIdByPassword(password.trim());
    if (!organizationId) {
      return res.status(401).json({ error: 'Invalid survey password' });
    }

    await connectMaster();
    const Organization = getMasterOrganizationModel();
    const org = await Organization.findOne({ uuid: organizationId, isActive: true });
    if (!org) {
      return res.status(404).json({ error: 'Organisation not found' });
    }

    setSurveyAccessCookie(res, organizationId);

    return res.status(200).json({
      organizationId,
      organizationName: org.name,
      redirectUrl: `/play?org=${organizationId}`,
    });
  } catch (err) {
    console.error('Survey unlock error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
