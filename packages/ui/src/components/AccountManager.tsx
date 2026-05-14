import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Eye, EyeOff } from "lucide-react";

export interface Account {
  id?: string;
  key: string;
  email?: string;
  label?: string;
  status?: 'active' | 'exhausted' | 'rate_limited';
}

interface AccountManagerProps {
  accounts?: Account[];
  onChange: (accounts: Account[]) => void;
  legacyApiKey?: string;
  onLegacyApiKeyChange?: (key: string) => void;
}

export function AccountManager({
  accounts = [],
  onChange,
  legacyApiKey = "",
  onLegacyApiKeyChange,
}: AccountManagerProps) {
  const { t } = useTranslation();
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({});
  const [showLegacyKey, setShowLegacyKey] = useState(false);

  const handleAddAccount = () => {
    const newAccount: Account = {
      key: "",
      label: `Account ${(accounts?.length || 0) + 1}`,
      status: "active",
    };
    onChange([...(accounts || []), newAccount]);
  };

  const handleRemoveAccount = (index: number) => {
    const updatedAccounts = (accounts || []).filter((_, i) => i !== index);
    onChange(updatedAccounts);
  };

  const handleUpdateAccount = (index: number, field: keyof Account, value: string) => {
    const updatedAccounts = [...(accounts || [])];
    updatedAccounts[index] = {
      ...updatedAccounts[index],
      [field]: value,
    };
    onChange(updatedAccounts);
  };

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case "exhausted":
        return "bg-red-100 text-red-800";
      case "rate_limited":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };

  return (
    <div className="space-y-4">
      {/* Legacy API Key (deprecated, shown if present) */}
      {legacyApiKey && onLegacyApiKeyChange && (
        <div className="space-y-2 p-3 bg-gray-50 border border-gray-200 rounded">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Legacy API Key (Deprecated)</Label>
            <Badge variant="outline" className="text-xs">Legacy</Badge>
          </div>
          <div className="relative">
            <Input
              type={showLegacyKey ? "text" : "password"}
              value={legacyApiKey}
              onChange={(e) => onLegacyApiKeyChange(e.target.value)}
              placeholder="Enter legacy API key"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
              onClick={() => setShowLegacyKey(!showLegacyKey)}
            >
              {showLegacyKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Consider migrating to the multi-account system by adding accounts below.
          </p>
        </div>
      )}

      {/* Multi-Account Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">API Accounts</Label>
          <Badge variant="secondary">{accounts?.length || 0} account(s)</Badge>
        </div>

        {!accounts || accounts.length === 0 ? (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
            No accounts configured. Click "Add Account" to get started with multi-account support.
          </div>
        ) : null}

        {/* Accounts List */}
        <div className="space-y-2">
          {(accounts || []).map((account, index) => (
            <div key={index} className="p-3 border rounded space-y-2 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-medium text-gray-700">
                    {account.label || `Account ${index + 1}`}
                  </span>
                  {account.email && (
                    <span className="text-xs text-gray-500">{account.email}</span>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs ${getStatusBadgeColor(account.status)}`}
                  >
                    {account.status || "active"}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleRemoveAccount(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* API Key Input */}
              <div className="space-y-1">
                <Label htmlFor={`key-${index}`} className="text-xs font-medium">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    id={`key-${index}`}
                    type={showKeys[index] ? "text" : "password"}
                    value={account.key}
                    onChange={(e) => handleUpdateAccount(index, "key", e.target.value)}
                    placeholder="Enter API key"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
                    onClick={() =>
                      setShowKeys((prev) => ({
                        ...prev,
                        [index]: !prev[index],
                      }))
                    }
                  >
                    {showKeys[index] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-1">
                <Label htmlFor={`email-${index}`} className="text-xs font-medium">
                  Email (Optional)
                </Label>
                <Input
                  id={`email-${index}`}
                  type="email"
                  value={account.email || ""}
                  onChange={(e) => handleUpdateAccount(index, "email", e.target.value)}
                  placeholder="user@example.com"
                />
              </div>

              {/* Label Input */}
              <div className="space-y-1">
                <Label htmlFor={`label-${index}`} className="text-xs font-medium">
                  Label (Optional)
                </Label>
                <Input
                  id={`label-${index}`}
                  value={account.label || ""}
                  onChange={(e) => handleUpdateAccount(index, "label", e.target.value)}
                  placeholder={`Account ${index + 1}`}
                />
              </div>

              {/* ID Input (for providers like Cloudflare) */}
              {account.id && (
                <div className="space-y-1">
                  <Label htmlFor={`id-${index}`} className="text-xs font-medium">
                    Account ID (Optional)
                  </Label>
                  <Input
                    id={`id-${index}`}
                    value={account.id || ""}
                    onChange={(e) => handleUpdateAccount(index, "id", e.target.value)}
                    placeholder="Account ID"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Account Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleAddAccount}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Info Box */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 space-y-2">
        <p className="font-medium">Multi-Account Support</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Add multiple API keys for the same provider</li>
          <li>Automatic key rotation on rate limits (429)</li>
          <li>Track usage by email/account</li>
          <li>Failed accounts marked as exhausted</li>
        </ul>
      </div>
    </div>
  );
}
