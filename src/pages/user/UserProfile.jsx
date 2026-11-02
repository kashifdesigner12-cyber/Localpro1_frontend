import { useCallback, useEffect, useRef, useState } from "react";
import {
  UserRound,
  Phone,
  BriefcaseBusiness,
  MapPin,
  Camera,
  Pencil,
  Save,
  X,
  Trash2,
  ShieldCheck,
  CalendarDays,
  Mail,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../../services/api";

const emptyProfile = {
  name: "",
  email: "",
  phone: "",
  location: "",
  department: "",
  designation: "",
};

const personalFields = [
  {
    name: "name",
    label: "Full Name",
    placeholder: "Enter your full name",
    icon: UserRound,
    required: true,
  },
  {
    name: "phone",
    label: "Phone Number",
    placeholder: "Enter your phone number",
    icon: Phone,
  },
  {
    name: "location",
    label: "Location",
    placeholder: "Enter your location",
    icon: MapPin,
  },
];

const workFields = [
  {
    name: "department",
    label: "Department",
    placeholder: "Enter your department",
    icon: BriefcaseBusiness,
  },
  {
    name: "designation",
    label: "Job Title",
    placeholder: "Enter your job title",
    icon: ShieldCheck,
  },
];

const getProfileData = (user = {}) => ({
  name: user.name || user.username || "",
  email: user.email || "",
  phone: user.phone || "",
  location: user.location || "",
  department: user.department || "",
  designation: user.designation || user.jobTitle || "",
});

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallback;

export default function UserProfile() {
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(emptyProfile);
  const [savedProfile, setSavedProfile] = useState(emptyProfile);
  const [photo, setPhoto] = useState("");
  const [savedPhoto, setSavedPhoto] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [role, setRole] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  const todayHeader = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/auth/me");
      const user =
        response.data?.user ||
        response.data?.data ||
        response.data;

      const userProfile = getProfileData(user);
      const userPhoto = user.profilePicture || "";

      setProfile(userProfile);
      setSavedProfile(userProfile);
      setPhoto(userPhoto);
      setSavedPhoto(userPhoto);
      setRole(user.role || "");
      setCreatedAt(user.createdAt || "");
      setMessage("");
    } catch (error) {
      showMessage(
        getErrorMessage(error, "Unable to load your profile."),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showMessage("Please select a valid image.", "error");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage("Image size must be less than 5 MB.", "error");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setPhoto(String(reader.result || ""));
      showMessage("Photo selected. Save changes to apply it.", "info");
    };

    reader.onerror = () => {
      showMessage("Unable to read this image.", "error");
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!profile.name.trim()) {
      showMessage("Full name is required.", "error");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await api.patch("/auth/me", {
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        location: profile.location.trim(),
        department: profile.department.trim(),
        designation: profile.designation.trim(),
        profilePicture: photo,
      });

      const user =
        response.data?.user ||
        response.data?.data ||
        response.data;

      const updatedProfile = getProfileData({
        ...profile,
        ...user,
        email: user.email ?? profile.email,
      });

      const updatedPhoto = user.profilePicture ?? photo;

      setProfile(updatedProfile);
      setSavedProfile(updatedProfile);
      setPhoto(updatedPhoto);
      setSavedPhoto(updatedPhoto);
      setRole(user.role || role);
      setCreatedAt(user.createdAt || createdAt);
      setEditing(false);

      showMessage("Profile updated successfully.", "success");
    } catch (error) {
      showMessage(
        getErrorMessage(error, "Unable to save profile changes."),
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setProfile({ ...savedProfile });
    setPhoto(savedPhoto);
    setEditing(false);
    setMessage("");
  };

  const handleRemovePhoto = () => {
    setPhoto("");
    showMessage("Photo removal selected. Save changes to apply it.", "info");
  };

  const formatDate = (date) => {
    if (!date) return "Not available";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Not available";
    }

    return parsedDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const inputClass = editing
    ? "min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
    : "min-h-11 w-full rounded-2xl border border-slate-200/60 bg-slate-100/60 pl-10 pr-4 text-sm font-semibold text-slate-500 cursor-not-allowed outline-none";

  const renderFields = (items) =>
    items.map((field) => {
      const Icon = field.icon;

      return (
        <div key={field.name}>
          <label
            htmlFor={field.name}
            className="mb-2 block text-sm font-bold text-slate-800"
          >
            {field.label}
            {field.required && (
              <span className="ml-1 text-rose-500">*</span>
            )}
          </label>

          <div className="relative">
            <Icon
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id={field.name}
              name={field.name}
              value={profile[field.name]}
              onChange={updateField}
              placeholder={field.placeholder}
              required={field.required}
              readOnly={!editing || saving}
              className={inputClass}
            />
          </div>
        </div>
      );
    });

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section matching Ventes clean style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            My Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            My Profile
          </h1>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
          <CalendarDays size={17} className="text-violet-600" />
          <span>{todayHeader}</span>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-2xl border px-5 py-3.5 text-sm font-medium shadow-2xs ${
            messageType === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            {messageType === "error" && <AlertCircle size={18} className="mt-0.5 shrink-0" />}
            {messageType === "success" && <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="rounded-xl p-1.5 transition hover:bg-black/5 text-slate-400 hover:text-slate-700"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <section className="rounded-3xl border border-slate-100 bg-white p-12 text-center text-sm text-slate-400 shadow-xs">
          Loading profile...
        </section>
      ) : (
        <>
          {/* Avatar and Main Info Header Card */}
          <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="relative h-24 w-24 shrink-0">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-violet-50 text-violet-600 shadow-xs">
                    {photo ? (
                      <img
                        src={photo}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound size={42} />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!editing) {
                        showMessage(
                          "Click Edit Profile before changing your photo."
                        );
                        return;
                      }

                      fileInputRef.current?.click();
                    }}
                    disabled={saving}
                    className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-violet-600 text-white transition hover:bg-violet-700 disabled:opacity-50 shadow-sm active:scale-95"
                    title="Change profile picture"
                    aria-label="Change profile picture"
                  >
                    <Camera size={16} />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>

                <div className="min-w-0">
                  <h2 className="break-words text-xl font-bold text-slate-900">
                    {profile.name || "Your Name"}
                  </h2>
                  <p className="mt-1 flex items-center gap-2 break-all text-xs font-semibold text-slate-500">
                    <Mail size={15} className="shrink-0 text-violet-600" />
                    {profile.email || "No email configured"}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {profile.designation || "Team Member"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {photo && editing && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Trash2 size={15} className="text-rose-600" />
                    Remove Photo
                  </button>
                )}

                {!editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setMessage("");
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
                  >
                    <Pencil size={15} />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Choose an image up to 5 MB. Save changes to update your profile.
            </p>
          </section>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Personal Information Section */}
            <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h3 className="font-bold text-slate-900 text-base">
                  Personal Information
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Your personal and contact details. Email is not editable here.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {renderFields(personalFields)}
              </div>
            </section>

            {/* Work Information Section */}
            <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h3 className="font-bold text-slate-900 text-base">
                  Work Information
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Your role and department details.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {renderFields(workFields)}

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-800">
                    Account Type
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-slate-100/60 px-4 py-3">
                    <ShieldCheck size={17} className="text-slate-400" />
                    <span className="text-sm font-semibold capitalize text-slate-600">
                      {role || "Managed by administrator"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-800">
                    Member Since
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-slate-100/60 px-4 py-3">
                    <CalendarDays size={17} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-600">
                      {formatDate(createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {editing && (
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <X size={16} />
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
}