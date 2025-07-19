import { NextRequest, NextResponse } from 'next/server';
import { IdentifierService } from '../services/identifier';

type EntityType = 'card' | 'project';

export async function resolveIdentifier(
  request: NextRequest,
  { params }: { params: { id?: string; slug?: string; } },
  entityType: EntityType
) {
  const identifier = params.id || params.slug;
  if (!identifier) {
    return NextResponse.json({ error: 'Identifier not provided' }, { status: 400 });
  }

  const resolveMethod = entityType === 'card' 
    ? IdentifierService.resolveCard 
    : IdentifierService.resolveProject;

  const entity = await resolveMethod(identifier);
  if (!entity) {
    return NextResponse.json(
      { error: `${entityType} not found` }, 
      { status: 404 }
    );
  }

  // Attach the resolved entity to the request for downstream handlers
  // @ts-ignore - Extending NextRequest
  request.resolvedEntity = entity;
  
  return null; // Continue to next middleware/handler
}
