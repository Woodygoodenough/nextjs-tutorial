import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

export default function DemoLoginButton() {
  return (
    <form
      action={async () => {
        "use server";
        const fd = new FormData();
        fd.set("email", "valuable@student.com");
        fd.set("password", "123456");
        fd.set("redirectTo", "/dashboard");
        await signIn("credentials", fd);
      }}
    >
      <Button size="lg" type="submit">
        <Rocket className="relative size-4" />
        <span className="text-nowrap">Continue Demo</span>
      </Button>
    </form>
  );
}

