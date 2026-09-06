"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Trash2, UserPlus, Users, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Org = {
  id: string;
  plan: string;
};

export function OrgMembersManager({ 
  org, 
  initialMembers 
}: { 
  org: Org;
  initialMembers: any[];
}) {
  const [members, setMembers] = useState<any[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const canInvite = org.plan === "agency";
  const activeMembersCount = members.length;
  const isAtLimit = activeMembersCount >= 5;



  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInvite) {
      toast.error("Freelancers cannot invite teammates. Please upgrade to Agency.");
      return;
    }
    if (isAtLimit) {
      toast.error("You have reached the maximum of 5 teammates for this plan.");
      return;
    }

    setIsInviting(true);
    try {
      const { error } = await authClient.organization.inviteMember({
        email,
        role: "member",
      });
      
      if (error) {
        toast.error(error.message || "Failed to invite teammate");
      } else {
        toast.success("Teammate invited successfully");
        setEmail("");
        // We could fetch invites here if better-auth supports listing pending invites
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to invite teammate");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberIdOrUserId: string) => {
    try {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberIdOrUserId
      });
      if (error) {
        toast.error(error.message || "Failed to remove teammate");
      } else {
        toast.success("Teammate removed");
        setMembers(prev => prev.filter(m => m.id !== memberIdOrUserId && m.user?.id !== memberIdOrUserId));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove teammate");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Manage your agency teammates (Max 5 on current plan).</CardDescription>
          </div>
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">
            {activeMembersCount} / 5
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {!canInvite && (
          <div className="bg-muted/50 border border-border px-4 py-3 rounded-lg text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Team management is only available on the Agency plan.</span>
            <Button size="sm" variant="outline" type="button" disabled>Upgrade to Agency</Button>
          </div>
        )}

        {canInvite && (
          <form onSubmit={handleInvite} className="flex items-end gap-4">
            <div className="space-y-2 flex-1 max-w-sm">
              <Label htmlFor="email">Invite Teammate</Label>
              <Input 
                id="email"
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@agency.com" 
                disabled={!canInvite || isAtLimit || isInviting}
              />
            </div>
            <Button 
              type="submit" 
              disabled={!canInvite || isAtLimit || isInviting || !email.trim()}
              className="active:scale-[0.97] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            >
              {isInviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Invite
            </Button>
          </form>
        )}

        <div className="space-y-4 pt-4 border-t border-border/40">
          <h3 className="text-sm font-medium">Active Members</h3>
          <div className="divide-y divide-border/40 border rounded-lg overflow-hidden">
            {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-background group">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={m.user?.image} />
                      <AvatarFallback className="bg-muted text-[11px] font-medium text-muted-foreground">
                        {m.user?.name?.charAt(0).toUpperCase() || m.user?.email.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-foreground flex items-center gap-2">
                        {m.user?.name || "Unknown"}
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider text-muted-foreground font-semibold">
                          {m.role}
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground">{m.user?.email}</span>
                    </div>
                  </div>
                  {m.role !== "owner" && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleRemove(m.id)}
                      className="opacity-0 group-hover:opacity-100 transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <Users className="w-8 h-8 opacity-20" />
                  No other teammates found.
                </div>
              )}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
