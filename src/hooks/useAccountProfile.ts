/**
 * ODA1_0200 — Data hook: hồ sơ cá nhân (avatar, thông tin, đổi mật khẩu).
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAccountProfile() {
  const { profile, refreshProfile } = useAuth();

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!profile) return { error: new Error("Chưa đăng nhập") };
      const ext = file.name.split(".").pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) return { error: uploadError };

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      if (!error) refreshProfile();
      return { error };
    },
    [profile, refreshProfile],
  );

  const saveProfile = useCallback(
    async (fullName: string, phone: string) => {
      if (!profile) return { error: new Error("Chưa đăng nhập") };
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("id", profile.id);
      if (!error) refreshProfile();
      return { error };
    },
    [profile, refreshProfile],
  );

  /** Xác thực mật khẩu hiện tại rồi mới đổi mật khẩu mới. */
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || "",
        password: currentPassword,
      });
      if (signInError) return { error: new Error("Mật khẩu hiện tại không đúng") };
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error };
    },
    [profile?.email],
  );

  return { profile, uploadAvatar, saveProfile, changePassword };
}
