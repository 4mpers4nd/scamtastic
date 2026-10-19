'use server';

import { revalidatePath } from 'next/cache';
import { getUserOrNull } from '@/lib/auth-state.mjs';
import { supabaseServer } from '@/lib/server';
import { sendActivationEmail } from '@/lib/activation';

export type ActionResult = { message: string; error: boolean } | null;

function textField(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === 'string' && value.length <= max ? value.trim() : null;
}

async function requireAdminDb() {
  const db = await supabaseServer();
  const user = await getUserOrNull(db.auth);
  if (!user) return { db: null, user: null };
  const { data, error } = await db.rpc('is_scamtastic_admin');
  if (error) throw error;
  return data === true
    ? { db, user }
    : { db: null, user: null };
}

export async function reviewApplication(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = textField(formData, 'applicationId', 36);
  const status = textField(formData, 'status', 8);
  const notes = textField(formData, 'adminNotes', 4000);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) ||
    (status !== 'approved' && status !== 'rejected') || notes === null) {
    return { message: 'Invalid application review request.', error: true };
  }

  try {
    const { db } = await requireAdminDb();
    if (!db) return { message: 'Administrator access required.', error: true };

    const { data, error } = await db.rpc('admin_review_application', {
      p_application_id: id,
      p_status: status,
      p_admin_notes: notes || null,
    });
    if (error) throw error;

    if (status === 'approved') {
      const record = data as { email?: unknown } | null;
      if (typeof record?.email !== 'string') {
        throw new Error('Approval succeeded but the activation email address was unavailable.');
      }
      try {
        await sendActivationEmail(record.email);
      } catch (deliveryError) {
        const { error: statusError } = await db.rpc('admin_set_activation_status', {
          p_application_id: id,
          p_status: 'failed',
        });
        if (statusError) console.error('Unable to record activation delivery failure:', statusError);
        console.error(
          'Activation email delivery failed:',
          deliveryError instanceof Error ? deliveryError.message : 'unknown error',
        );
        revalidatePath('/admin/applications');
        return {
          message: 'Approved, but activation email delivery failed. Check the email provider configuration and retry.',
          error: true,
        };
      }

      const { error: statusError } = await db.rpc('admin_set_activation_status', {
        p_application_id: id,
        p_status: 'sent',
      });
      if (statusError) {
        console.error('Activation email sent but status update failed:', statusError);
        revalidatePath('/admin/applications');
        return {
          message: 'Approved and the email was sent, but its delivery status could not be recorded.',
          error: true,
        };
      }
    }

    revalidatePath('/admin');
    revalidatePath('/admin/applications');
    revalidatePath('/admin/players');
    return {
      message: status === 'approved' ? 'Application approved; activation email sent.' : 'Application rejected.',
      error: false,
    };
  } catch (error) {
    console.error('Application review failed:', error);
    return {
      message: 'Review failed. The application may already have been reviewed; refresh and try again.',
      error: true,
    };
  }
}

export async function retryActivation(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = textField(formData, 'applicationId', 36);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { message: 'Invalid application.', error: true };
  }

  try {
    const { db } = await requireAdminDb();
    if (!db) return { message: 'Administrator access required.', error: true };
    const { data, error } = await db.rpc('admin_list_applications', {
      p_status: 'approved',
      p_search: '',
    });
    if (error) throw error;
    const application = (data as Array<{ id: string; email: string; activation_status: string }>).find(
      (item) => item.id === id,
    );
    if (!application) return { message: 'Approved application not found.', error: true };
    if (application.activation_status === 'claimed') {
      return { message: 'This application has already been activated.', error: true };
    }

    try {
      await sendActivationEmail(application.email);
    } catch (mailError) {
      const { error: statusError } = await db.rpc('admin_set_activation_status', {
        p_application_id: id,
        p_status: 'failed',
      });
      if (statusError) console.error('Unable to record activation retry failure:', statusError);
      throw mailError;
    }
    const { error: statusError } = await db.rpc('admin_set_activation_status', {
      p_application_id: id,
      p_status: 'sent',
    });
    if (statusError) throw statusError;
    revalidatePath('/admin/applications');
    return { message: 'Activation email sent.', error: false };
  } catch (error) {
    console.error('Activation email retry failed:', error);
    return { message: 'Unable to send the activation email. Check Supabase Auth email settings.', error: true };
  }
}

export async function setPlayerSuspended(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = textField(formData, 'playerId', 36);
  const suspended = textField(formData, 'suspended', 5);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || (suspended !== 'true' && suspended !== 'false')) {
    return { message: 'Invalid player update.', error: true };
  }
  try {
    const { db } = await requireAdminDb();
    if (!db) return { message: 'Administrator access required.', error: true };
    const { error } = await db.rpc('admin_set_player_suspended', {
      p_player_id: id,
      p_suspended: suspended === 'true',
    });
    if (error) throw error;
    revalidatePath('/admin');
    revalidatePath('/admin/players');
    revalidatePath('/game');
    return { message: suspended === 'true' ? 'Player suspended.' : 'Player restored.', error: false };
  } catch (error) {
    console.error('Player access update failed:', error);
    return {
      message: error instanceof Error && error.message.includes('last administrator')
        ? 'The last administrator cannot be suspended.'
        : 'Unable to update player access.',
      error: true,
    };
  }
}

export async function updatePlayer(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = textField(formData, 'playerId', 36);
  const displayName = textField(formData, 'displayName', 80);
  const bio = textField(formData, 'bio', 500);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || displayName === null || bio === null) {
    return { message: 'Check the profile fields and try again.', error: true };
  }
  try {
    const { db } = await requireAdminDb();
    if (!db) return { message: 'Administrator access required.', error: true };
    const { error } = await db.rpc('admin_update_player', {
      p_player_id: id,
      p_display_name: displayName || null,
      p_bio: bio,
    });
    if (error) throw error;
    revalidatePath('/admin/players');
    revalidatePath('/profile/[username]', 'page');
    return { message: 'Player profile updated.', error: false };
  } catch (error) {
    console.error('Player profile update failed:', error);
    return { message: 'Unable to update the player profile.', error: true };
  }
}

export async function revokeReferral(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = textField(formData, 'codeId', 36);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { message: 'Invalid referral code.', error: true };
  }
  try {
    const { db } = await requireAdminDb();
    if (!db) return { message: 'Administrator access required.', error: true };
    const { error } = await db.rpc('revoke_referral_code', { p_code_id: id });
    if (error) throw error;
    revalidatePath('/admin/referrals');
    revalidatePath('/settings');
    return { message: 'Referral code revoked.', error: false };
  } catch (error) {
    console.error('Referral revocation failed:', error);
    return { message: 'Unable to revoke referral code.', error: true };
  }
}

export async function updateOwnProfile(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const displayName = textField(formData, 'displayName', 80);
  const bio = textField(formData, 'bio', 500);
  if (displayName === null || bio === null) {
    return { message: 'Check the profile fields and try again.', error: true };
  }

  try {
    const db = await supabaseServer();
    const user = await getUserOrNull(db.auth);
    if (!user) return { message: 'Sign in to update account settings.', error: true };
    const { error } = await db
      .from('profiles')
      .update({
        display_name: displayName || null,
        bio,
      })
      .eq('id', user.id);
    if (error) throw error;
    revalidatePath('/settings');
    revalidatePath('/profile/[username]', 'page');
    return { message: 'Account settings saved.', error: false };
  } catch (error) {
    console.error('Account settings update failed:', error);
    return { message: 'Unable to save account settings.', error: true };
  }
}

export async function createOwnReferral(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const limit = Number(formData.get('usageLimit'));
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { message: 'Choose a limit from 1 to 100.', error: true };
  }
  try {
    const db = await supabaseServer();
    const user = await getUserOrNull(db.auth);
    if (!user) return { message: 'Sign in to create a referral code.', error: true };
    const { error } = await db.rpc('create_referral_code', { p_usage_limit: limit });
    if (error) throw error;
    revalidatePath('/settings');
    return { message: 'Referral code created.', error: false };
  } catch (error) {
    console.error('Referral code creation failed:', error);
    return {
      message: error instanceof Error && error.message.includes('Approved player')
        ? 'Only approved, active players can create referral codes.'
        : 'Unable to create a referral code.',
      error: true,
    };
  }
}

export async function revokeOwnReferral(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = textField(formData, 'codeId', 36);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { message: 'Invalid referral code.', error: true };
  }
  try {
    const db = await supabaseServer();
    const user = await getUserOrNull(db.auth);
    if (!user) return { message: 'Sign in to revoke a referral code.', error: true };
    const { error } = await db.rpc('revoke_own_referral_code', { p_code_id: id });
    if (error) throw error;
    revalidatePath('/settings');
    return { message: 'Referral code revoked.', error: false };
  } catch (error) {
    console.error('Own referral revocation failed:', error);
    return { message: 'Unable to revoke this referral code.', error: true };
  }
}
