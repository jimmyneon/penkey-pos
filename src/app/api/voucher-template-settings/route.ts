export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import {
  DEFAULT_VOUCHER_LAYOUT,
  DEFAULT_VOUCHER_TEMPLATE,
  VoucherLayoutConfig,
  VoucherTemplate,
} from '@/lib/voucher/voucher-layout-config';

// GET — load the org's voucher templates + active template id
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: settings } = await supabase
    .from('org_settings')
    .select('settings')
    .eq('org_id', session.org_id)
    .maybeSingle();

  const s = (settings as any)?.settings || {};
  const templates: VoucherTemplate[] = s.voucher_templates || [];
  const activeTemplateId: string = s.active_voucher_template_id || 'default';

  // Migrate old single-layout format to templates array
  if (templates.length === 0 && s.voucher_template_layout) {
    const migrated: VoucherTemplate = {
      id: 'custom',
      name: 'Custom Template',
      imageUrl: '/voucher.png',
      layout: mergeLayout(DEFAULT_VOUCHER_LAYOUT, s.voucher_template_layout),
      createdAt: new Date().toISOString(),
    };
    templates.push(DEFAULT_VOUCHER_TEMPLATE, migrated);
  }

  // Always ensure default template exists
  if (!templates.find((t) => t.id === 'default')) {
    templates.unshift(DEFAULT_VOUCHER_TEMPLATE);
  }

  // Merge layouts with defaults to ensure new fields exist
  const mergedTemplates = templates.map((t) => ({
    ...t,
    layout: mergeLayout(DEFAULT_VOUCHER_LAYOUT, t.layout),
  }));

  return NextResponse.json({
    templates: mergedTemplates,
    activeTemplateId,
  });
}

// POST — save or update a template, or set active template
export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch existing settings
  const { data: existing } = await supabase
    .from('org_settings')
    .select('settings')
    .eq('org_id', session.org_id)
    .maybeSingle();

  const currentSettings = (existing as any)?.settings || {};
  let templates: VoucherTemplate[] = currentSettings.voucher_templates || [];

  // Always ensure default exists
  if (!templates.find((t) => t.id === 'default')) {
    templates.unshift({ ...DEFAULT_VOUCHER_TEMPLATE });
  }

  // Action: set active template
  if (body.action === 'setActive' && body.templateId) {
    const updatedSettings = {
      ...currentSettings,
      active_voucher_template_id: body.templateId,
    };
    const { error } = await supabase
      .from('org_settings')
      .upsert(
        { org_id: session.org_id, settings: updatedSettings } as any,
        { onConflict: 'org_id' }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Action: save/update a template
  const template = body.template as VoucherTemplate | undefined;
  if (!template || !template.id || !template.name || !template.imageUrl) {
    return NextResponse.json({ error: 'Missing template fields' }, { status: 400 });
  }

  // Merge layout with defaults
  const mergedLayout = mergeLayout(DEFAULT_VOUCHER_LAYOUT, template.layout);

  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    // Update existing
    templates[idx] = { ...template, layout: mergedLayout };
  } else {
    // Create new
    templates.push({ ...template, layout: mergedLayout, createdAt: new Date().toISOString() });
  }

  const updatedSettings = {
    ...currentSettings,
    voucher_templates: templates,
    active_voucher_template_id: template.id,
  };

  const { error } = await supabase
    .from('org_settings')
    .upsert(
      { org_id: session.org_id, settings: updatedSettings } as any,
      { onConflict: 'org_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, templates });
}

// DELETE — delete a template by id
export async function DELETE(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get('id');

  if (!templateId || templateId === 'default') {
    return NextResponse.json({ error: 'Cannot delete default template' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await supabase
    .from('org_settings')
    .select('settings')
    .eq('org_id', session.org_id)
    .maybeSingle();

  const currentSettings = (existing as any)?.settings || {};
  let templates: VoucherTemplate[] = currentSettings.voucher_templates || [];
  templates = templates.filter((t) => t.id !== templateId);

  const activeId = currentSettings.active_voucher_template_id === templateId
    ? 'default'
    : currentSettings.active_voucher_template_id;

  const updatedSettings = {
    ...currentSettings,
    voucher_templates: templates,
    active_voucher_template_id: activeId,
  };

  const { error } = await supabase
    .from('org_settings')
    .upsert(
      { org_id: session.org_id, settings: updatedSettings } as any,
      { onConflict: 'org_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, templates });
}

// Deep merge: ensure all default keys exist, override with saved values
function mergeLayout(
  defaults: VoucherLayoutConfig,
  saved: Partial<VoucherLayoutConfig>
): VoucherLayoutConfig {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof VoucherLayoutConfig)[]) {
    if (saved[key]) {
      result[key] = { ...defaults[key], ...saved[key] } as any;
    }
  }
  return result;
}
