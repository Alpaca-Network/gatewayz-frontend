#!/usr/bin/.env python3
"""
Professional Email Templates for AI Gateway
"""

from typing import Dict, Any
import os

class ProfessionalEmailTemplates:
    """Professional email templates with modern design"""

    def __init__(self, app_name: str = "Gatewayz", app_url: str = "https://betagatewayz.ai", support_email: str = None):
        self.app_name = app_name
        self.app_url = app_url
        # Use provided support email or extract from URL
        if support_email:
            self.support_email = support_email
        else:
            # Extract domain from URL and use support email
            domain = app_url.split('//')[-1].replace('beta.', '').replace('www.', '')
            self.support_email = f"support@{domain}"
    
    def get_base_template(self) -> str:
        """Base HTML template with modern design"""
        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f9fafb;
        }}
        
        .email-container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }}
        
        .header {{
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
            color: white;
            padding: 50px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }}

        .header::before {{
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 4s ease-in-out infinite;
        }}

        @keyframes pulse {{
            0%, 100% {{ transform: scale(1); opacity: 0.5; }}
            50% {{ transform: scale(1.1); opacity: 0.8; }}
        }}
        
        .header h1 {{
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }}
        
        .header p {{
            font-size: 16px;
            opacity: 0.9;
        }}
        
        .content {{
            padding: 40px 30px;
        }}
        
        .content h2 {{
            font-size: 24px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 16px;
        }}
        
        .content p {{
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 20px;
        }}
        
        .highlight-box {{
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
        }}
        
        .info-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin: 20px 0;
        }}
        
        .info-item {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
            text-align: center;
        }}
        
        .info-item .label {{
            font-size: 14px;
            color: #64748b;
            font-weight: 500;
            margin-bottom: 4px;
        }}
        
        .info-item .value {{
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
        }}
        
        .cta-button {{
            display: inline-block;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 16px;
            margin: 20px 8px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}

        .cta-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(99, 102, 241, 0.5);
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
        }}
        
        .secondary-button {{
            background: #f8fafc;
            color: #374151;
            border: 1px solid #d1d5db;
        }}
        
        .footer {{
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }}
        
        .footer p {{
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 8px;
        }}
        
        .social-links {{
            margin: 20px 0;
        }}
        
        .social-links a {{
            display: inline-block;
            margin: 0 8px;
            color: #6b7280;
            text-decoration: none;
        }}
        
        .divider {{
            height: 1px;
            background: #e5e7eb;
            margin: 24px 0;
        }}
        
        .warning-box {{
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }}
        
        .success-box {{
            background: #d1fae5;
            border: 1px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }}
        
        .api-key-box {{
            background: #1f2937;
            color: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            word-break: break-all;
        }}
        
        @media (max-width: 600px) {{
            .email-container {{ margin: 0; border-radius: 0; }}
            .content {{ padding: 30px 20px; }}
            .header {{ padding: 30px 20px; }}
            .info-grid {{ grid-template-columns: 1fr; }}
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>{app_name}</h1>
            <p>{header_subtitle}</p>
        </div>
        <div class="content">
            {content}
        </div>
        <div class="footer">
            <p>© 2025 {app_name}. All rights reserved.</p>
            <p>This email was sent to {email}</p>
            <div class="social-links">
                <a href="{app_url}">Website</a>
                <a href="{app_url}/docs">Documentation</a>
                <a href="mailto:{support_email}">Support</a>
            </div>
        </div>
    </div>
</body>
</html>
        """
    
    def welcome_email(self, username: str, email: str, credits: int) -> Dict[str, str]:
        """Welcome to Gatewayz!"""
        # Use display name if it looks like a real name, otherwise use email prefix
        display_name = username
        if username and not username.startswith(('google_', 'github_', 'privy_')):
            display_name = username
        elif email:
            display_name = email.split('@')[0].replace('.', ' ').title()
        else:
            display_name = "there"

        content = f"""
            <div style="text-align: center; margin: 30px 0;">
                <h2 style="font-size: 36px; font-weight: 800; margin-bottom: 12px; background: linear-gradient(135deg, #6366f1, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                    Welcome to the Future of AI 🚀
                </h2>
                <p style="font-size: 18px; color: #64748b; font-weight: 500;">Hi <strong style="color: #1e293b;">{display_name}</strong>, your journey starts now</p>
            </div>

            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%); border-radius: 16px; padding: 32px; margin: 30px 0; text-align: center; box-shadow: 0 10px 40px rgba(99, 102, 241, 0.3);">
                <div style="font-size: 48px; margin-bottom: 16px;">💎</div>
                <h3 style="color: white; font-size: 28px; font-weight: 700; margin-bottom: 12px;">Your Account is Ready!</h3>
                <p style="color: rgba(255,255,255,0.95); font-size: 18px; margin-bottom: 24px;">You've been credited with</p>
                <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border-radius: 12px; padding: 20px; display: inline-block;">
                    <div style="font-size: 48px; font-weight: 800; color: white; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">${credits}</div>
                    <div style="font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px;">Free Credits</div>
                </div>
            </div>

            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; margin: 30px 0;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 42px; margin-bottom: 12px;">🔑</div>
                    <h3 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Your API Key Awaits</h3>
                    <p style="color: #64748b; font-size: 16px;">Access unlimited AI models with a single key</p>
                </div>
                <div style="text-align: center;">
                    <a href="{self.app_url}/settings/keys" class="cta-button" style="font-size: 18px; padding: 18px 40px;">Get Your API Key</a>
                </div>
                <p style="font-size: 14px; color: #94a3b8; text-align: center; margin-top: 20px; font-weight: 500;">
                    🔒 Your key is encrypted and secured with enterprise-grade protection
                </p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0;">
                <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; transition: all 0.3s ease;">
                    <div style="font-size: 36px; margin-bottom: 12px;">⚡</div>
                    <div style="font-size: 32px; font-weight: 800; color: #6366f1; margin-bottom: 8px;">${credits}</div>
                    <div style="font-size: 14px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Free Credits</div>
                </div>
                <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; transition: all 0.3s ease;">
                    <div style="font-size: 36px; margin-bottom: 12px;">⏱️</div>
                    <div style="font-size: 32px; font-weight: 800; color: #ec4899; margin-bottom: 8px;">3 Days</div>
                    <div style="font-size: 14px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Trial Period</div>
                </div>
            </div>

            <div style="text-align: center; margin: 40px 0;">
                <a href="{self.app_url}/docs" class="cta-button">📚 Documentation</a>
                <a href="{self.app_url}/settings/credits" class="cta-button" style="background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%); box-shadow: 0 4px 20px rgba(236, 72, 153, 0.3);">🎯 Dashboard</a>
            </div>

            <div class="divider"></div>

            <div style="background: #f8fafc; border-radius: 12px; padding: 28px; margin: 30px 0;">
                <h3 style="font-size: 22px; font-weight: 700; color: #1e293b; margin-bottom: 20px; text-align: center;">
                    🚀 Get Started in Minutes
                </h3>
                <div style="display: grid; gap: 16px;">
                    <div style="display: flex; align-items: start; gap: 16px;">
                        <div style="flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 18px;">1</div>
                        <div>
                            <strong style="color: #1e293b; font-size: 16px;">Grab Your API Key</strong>
                            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Head to your <a href="{self.app_url}/settings/credits" style="color: #6366f1; text-decoration: none; font-weight: 600;">dashboard</a> and copy your key</p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: start; gap: 16px;">
                        <div style="flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #ec4899); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 18px;">2</div>
                        <div>
                            <strong style="color: #1e293b; font-size: 16px;">Explore AI Models</strong>
                            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Browse 300+ models from OpenAI, Anthropic, Google & more</p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: start; gap: 16px;">
                        <div style="flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #ec4899, #f43f5e); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 18px;">3</div>
                        <div>
                            <strong style="color: #1e293b; font-size: 16px;">Start Building</strong>
                            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Try our <a href="{self.app_url}/chat" style="color: #6366f1; text-decoration: none; font-weight: 600;">interactive chat</a> or dive into the <a href="{self.app_url}/docs" style="color: #6366f1; text-decoration: none; font-weight: 600;">docs</a></p>
                        </div>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin: 40px 0; padding: 24px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 12px;">
                <p style="color: #64748b; font-size: 16px; margin-bottom: 12px;">Need help? We're here for you</p>
                <a href="mailto:{self.support_email}" style="color: #6366f1; font-weight: 700; font-size: 18px; text-decoration: none;">
                    💬 {self.support_email}
                </a>
            </div>
        """
        
        return {
            "subject": f"🚀 Welcome to the Future of AI - ${credits} Free Credits Inside!",
            "html": self.get_base_template().format(
                subject=f"Welcome to {self.app_name}!",
                header_subtitle="Your AI Journey Starts Now",
                content=content,
                app_name=self.app_name,
                app_url=self.app_url,
                support_email=self.support_email,
                email=email
            ),
            "text": f"""Welcome to {self.app_name}!

Hi {display_name},

Welcome to {self.app_name}! We're excited to have you on board.

Your Account Details:
- Free Credits: ${credits}
- Trial Period: 3 days

Your API key is available in your dashboard for security reasons.

Quick Start:
1. Access your dashboard: {self.app_url}/settings/credits
2. Read our documentation: {self.app_url}/docs
3. Try our chat: {self.app_url}/chat
4. Check out examples: {self.app_url}/examples

Keep your API key secure and never share it publicly.

Questions? Contact us: {self.support_email}

Best regards,
The {self.app_name} Team
"""
        }
    
    def simple_welcome_email(self, username: str, email: str, credits: int) -> Dict[str, str]:
        """Simple, clean welcome email template"""
        # Use display name if it looks like a real name, otherwise use email prefix
        display_name = username
        if username and not username.startswith(('google_', 'github_', 'privy_')):
            display_name = username
        elif email:
            display_name = email.split('@')[0].replace('.', ' ').title()
        else:
            display_name = "there"
            
        content = f"""
            <h2>Welcome to {self.app_name}! 🎉</h2>
            <p>Hi <strong>{display_name}</strong>,</p>
            <p>Welcome to {self.app_name}! Your account is ready and you have <strong>${credits}</strong> in free credits to get started.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
                <h3 style="margin-bottom: 16px; color: #1e293b;">🔑 Get Your API Key</h3>
                <p style="margin-bottom: 20px; color: #64748b;">Your API key is ready in your dashboard</p>
                <a href="{self.app_url}/settings/credits" class="cta-button">View Dashboard</a>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{self.app_url}/docs" class="cta-button">📚 Documentation</a>
                <a href="{self.app_url}/chat" class="cta-button secondary-button">🚀 Try chat</a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 30px;">
                Questions? Contact us at <a href="mailto:{self.support_email}" style="color: #3b82f6;">{self.support_email}</a>
            </p>
        """
        
        return {
            "subject": f"Welcome to {self.app_name}! 🚀",
            "html": self.get_base_template().format(
                subject=f"Welcome to {self.app_name}!",
                header_subtitle="Your account is ready",
                content=content,
                app_name=self.app_name,
                app_url=self.app_url,
                support_email=self.support_email,
                email=email
            ),
            "text": f"""Welcome to {self.app_name}!

Hi {display_name},

Welcome to {self.app_name}! Your account is ready and you have ${credits} in free credits to get started.

Get your API key: {self.app_url}/settings/credits
Read documentation: {self.app_url}/docs
Try Chat: {self.app_url}/chat

Questions? Contact us: {self.support_email}

Best regards,
The {self.app_name} Team
"""
        }
    
    def low_balance_alert(self, username: str, email: str, current_credits: float, threshold: float, is_trial: bool = False, plan_name: str = None) -> Dict[str, str]:
        """Low balance alert email"""
        if is_trial:
            content = f"""
                <h2>⚠️ Trial Credits Running Low</h2>
                <p>Hi <strong>{username}</strong>,</p>
                <p>Your trial credits are running low! Don't worry, we've got you covered with upgrade options.</p>
                
                <div class="warning-box">
                    <h3 style="margin-bottom: 12px; color: #92400e;">Current Status</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="label">Current Credits</div>
                            <div class="value">${current_credits:.2f}</div>
                        </div>
                        <div class="info-item">
                            <div class="label">Alert Threshold</div>
                            <div class="value">${threshold:.2f}</div>
                        </div>
                    </div>
                </div>
                
                <p>To continue using our API after your trial ends, choose a plan that fits your needs:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{self.app_url}/pricing" class="cta-button">💎 View Plans & Upgrade</a>
                </div>
                
                <div class="divider"></div>
                
                <h3>🎯 Why Upgrade?</h3>
                <ul style="margin-left: 20px; color: #4b5563;">
                    <li style="margin-bottom: 8px;">Higher rate limits and more credits</li>
                    <li style="margin-bottom: 8px;">Priority support and faster response times</li>
                    <li style="margin-bottom: 8px;">Advanced features and analytics</li>
                    <li style="margin-bottom: 8px;">99.9% uptime SLA guarantee</li>
                </ul>
            """
            subject = f"Trial credits running low - Upgrade to continue using {self.app_name}"
        else:
            content = f"""
                <h2>⚠️ Account Balance Low</h2>
                <p>Hi <strong>{username}</strong>,</p>
                <p>Your account balance is running low. Add credits to continue using our API without interruption.</p>
                
                <div class="warning-box">
                    <h3 style="margin-bottom: 12px; color: #92400e;">Current Status</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="label">Current Credits</div>
                            <div class="value">${current_credits:.2f}</div>
                        </div>
                        <div class="info-item">
                            <div class="label">Alert Threshold</div>
                            <div class="value">${threshold:.2f}</div>
                        </div>
                        <div class="info-item">
                            <div class="label">Current Plan</div>
                            <div class="value">{plan_name or 'Unknown'}</div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{self.app_url}/billing" class="cta-button">💳 Add Credits Now</a>
                    <a href="{self.app_url}/pricing" class="cta-button secondary-button">📊 View Plans</a>
                </div>
                
                <div class="divider"></div>
                
                <h3>💡 Pro Tip</h3>
                <p>Set up auto-recharge to never run out of credits again. You can configure this in your <a href="{self.app_url}/billing" style="color: #3b82f6;">billing settings</a>.</p>
            """
            subject = f"Account balance low - Add credits to continue using {self.app_name}"
        
        return {
            "subject": subject,
            "html": self.get_base_template().format(
                subject="Low Balance Alert",
                header_subtitle="Action required",
                content=content,
                app_name=self.app_name,
                app_url=self.app_url,
                support_email=self.support_email,
                email=email
            ),
            "text": f"""Low Balance Alert - {self.app_name}

Hi {username},

Your account balance is running low!

Current Credits: ${current_credits:.2f}
Alert Threshold: ${threshold:.2f}
{f'Current Plan: {plan_name}' if plan_name else ''}

{'Upgrade your plan' if is_trial else 'Add credits'} to continue using our API:
{self.app_url}/{'pricing' if is_trial else 'billing'}

Questions? Contact us: {self.support_email}

Best regards,
The {self.app_name} Team
"""
        }
    
    def trial_expiry_alert(self, username: str, email: str, remaining_days: int, remaining_credits: float, remaining_tokens: int, remaining_requests: int, trial_end_date: str) -> Dict[str, str]:
        """Trial expiry alert email"""
        content = f"""
            <h2>⏰ Trial Expiring Soon</h2>
            <p>Hi <strong>{username}</strong>,</p>
            <p>Your free trial is expiring in <strong>{remaining_days} day(s)</strong>! Don't let your AI journey end here.</p>
            
            <div class="warning-box">
                <h3 style="margin-bottom: 12px; color: #92400e;">Trial Summary</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="label">Trial End Date</div>
                        <div class="value">{trial_end_date}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Remaining Credits</div>
                        <div class="value">${remaining_credits:.2f}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Remaining Tokens</div>
                        <div class="value">{remaining_tokens:,}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Remaining Requests</div>
                        <div class="value">{remaining_requests:,}</div>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{self.app_url}/pricing" class="cta-button">🚀 Upgrade Now</a>
                <a href="{self.app_url}/settings/activity" class="cta-button secondary-button">📊 View Usage</a>
            </div>
            
            <div class="divider"></div>
            
            <h3>🎯 Choose Your Plan</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin: 20px 0;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
                    <h4 style="color: #1e293b; margin-bottom: 8px;">Dev Plan</h4>
                    <p style="font-size: 24px; font-weight: 600; color: #3b82f6; margin-bottom: 4px;">$29/mo</p>
                    <p style="font-size: 14px; color: #64748b;">10M tokens, 300K requests</p>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
                    <h4 style="color: #1e293b; margin-bottom: 8px;">Team Plan</h4>
                    <p style="font-size: 24px; font-weight: 600; color: #3b82f6; margin-bottom: 4px;">$99/mo</p>
                    <p style="font-size: 14px; color: #64748b;">50M tokens, 1.5M requests</p>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
                    <h4 style="color: #1e293b; margin-bottom: 8px;">Customize</h4>
                    <p style="font-size: 24px; font-weight: 600; color: #3b82f6; margin-bottom: 4px;">Pay-as-you-go</p>
                    <p style="font-size: 14px; color: #64748b;">Unlimited usage</p>
                </div>
            </div>
            
            <p>Questions about our plans? Contact our team at <a href="mailto:{self.support_email}" style="color: #3b82f6;">{self.support_email}</a> - we're here to help!</p>
        """
        
        return {
            "subject": f"Trial expiring in {remaining_days} day(s) - Upgrade to continue using {self.app_name}",
            "html": self.get_base_template().format(
                subject="Trial Expiring Soon",
                header_subtitle="Upgrade to continue",
                content=content,
                app_name=self.app_name,
                app_url=self.app_url,
                support_email=self.support_email,
                email=email
            ),
            "text": f"""Trial Expiring Soon - {self.app_name}

Hi {username},

Your free trial is expiring in {remaining_days} day(s)!

Trial End Date: {trial_end_date}
Remaining Credits: ${remaining_credits:.2f}
Remaining Tokens: {remaining_tokens:,}
Remaining Requests: {remaining_requests:,}

Upgrade now to continue using our API:
{self.app_url}/pricing

Questions? Contact us: {self.support_email}

Best regards,
The {self.app_name} Team
"""
        }
    
    def subscription_expiry_alert(self, username: str, email: str, plan_name: str, remaining_days: int, end_date: str) -> Dict[str, str]:
        """Subscription expiry alert email"""
        content = f"""
            <h2>📅 Subscription Expiring Soon</h2>
            <p>Hi <strong>{username}</strong>,</p>
            <p>Your <strong>{plan_name}</strong> subscription is expiring in <strong>{remaining_days} day(s)</strong>. Renew now to avoid any service interruption.</p>
            
            <div class="warning-box">
                <h3 style="margin-bottom: 12px; color: #92400e;">Subscription Details</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="label">Current Plan</div>
                        <div class="value">{plan_name}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Expiry Date</div>
                        <div class="value">{end_date}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Remaining Days</div>
                        <div class="value">{remaining_days}</div>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{self.app_url}/billing" class="cta-button">🔄 Renew Subscription</a>
                <a href="{self.app_url}/pricing" class="cta-button secondary-button">📊 View Plans</a>
            </div>
            
            <div class="divider"></div>
            
            <h3>💡 What happens if I don't renew?</h3>
            <ul style="margin-left: 20px; color: #4b5563;">
                <li style="margin-bottom: 8px;">Your API access will be suspended</li>
                <li style="margin-bottom: 8px;">All active requests will be rejected</li>
                <li style="margin-bottom: 8px;">Your data and settings will be preserved for 30 days</li>
                <li style="margin-bottom: 8px;">You can reactivate anytime by renewing your subscription</li>
            </ul>
            
            <p>Need help choosing a plan? Our team is here to help at <a href="mailto:{self.support_email}" style="color: #3b82f6;">{self.support_email}</a>.</p>
        """
        
        return {
            "subject": f"{plan_name} subscription expiring in {remaining_days} day(s) - Renew now",
            "html": self.get_base_template().format(
                subject="Subscription Expiring Soon",
                header_subtitle="Renew to continue",
                content=content,
                app_name=self.app_name,
                app_url=self.app_url,
                support_email=self.support_email,
                email=email
            ),
            "text": f"""Subscription Expiring Soon - {self.app_name}

Hi {username},

Your {plan_name} subscription is expiring in {remaining_days} day(s)!

Expiry Date: {end_date}
Remaining Days: {remaining_days}

Renew now to avoid service interruption:
{self.app_url}/billing

Questions? Contact us: {self.support_email}

Best regards,
The {self.app_name} Team
"""
        }
    
    def credits_added_confirmation(self, username: str, email: str, credits_added: float, new_balance: float) -> Dict[str, str]:
        """Credits added confirmation email"""
        content = f"""
            <h2>✅ Credits Added Successfully</h2>
            <p>Hi <strong>{username}</strong>,</p>
            <p>Great news! Your account has been topped up with fresh credits.</p>
            
            <div class="success-box">
                <h3 style="margin-bottom: 12px; color: #065f46;">💰 Payment Confirmed</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="label">Credits Added</div>
                        <div class="value">${credits_added:.2f}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">New Balance</div>
                        <div class="value">${new_balance:.2f}</div>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{self.app_url}/settings/credits" class="cta-button">📊 View Dashboard</a>
                <a href="{self.app_url}/billing" class="cta-button secondary-button">💳 Billing History</a>
            </div>
            
            <div class="divider"></div>
            
            <h3>🚀 Ready to Build?</h3>
            <p>You're all set to continue building amazing AI applications! Here are some resources to help you get the most out of your credits:</p>
            
            <ul style="margin-left: 20px; color: #4b5563;">
                <li style="margin-bottom: 8px;"><a href="{self.app_url}/docs" style="color: #3b82f6;">API Documentation</a> - Complete reference guide</li>
                <li style="margin-bottom: 8px;"><a href="{self.app_url}/examples" style="color: #3b82f6;">Code Examples</a> - Ready-to-use snippets</li>
                <li style="margin-bottom: 8px;"><a href="{self.app_url}/chat" style="color: #3b82f6;">Interactive Chat</a> - Test ideas quickly</li>
                <li style="margin-bottom: 8px;"><a href="{self.app_url}/community" style="color: #3b82f6;">Developer Community</a> - Connect with other builders</li>
            </ul>
            
            <p>Thank you for choosing {self.app_name}! If you have any questions, our support team is here to help at <a href="mailto:{self.support_email}" style="color: #3b82f6;">{self.support_email}</a>.</p>
        """
        
        return {
            "subject": f"Credits added successfully - ${credits_added:.2f} added to your account",
            "html": self.get_base_template().format(
                subject="Credits Added Successfully",
                header_subtitle="Payment confirmed",
                content=content,
                app_name=self.app_name,
                app_url=self.app_url,
                support_email=self.support_email,
                email=email
            ),
            "text": f"""Credits Added Successfully - {self.app_name}

Hi {username},

Great news! Your account has been topped up with fresh credits.

Credits Added: ${credits_added:.2f}
New Balance: ${new_balance:.2f}

You're all set to continue building amazing AI applications!

Resources:
- API Documentation: {self.app_url}/docs
- Code Examples: {self.app_url}/examples
- Interactive Chat: {self.app_url}/chat

Questions? Contact us: {self.support_email}

Thank you for choosing {self.app_name}!

Best regards,
The {self.app_name} Team
"""
        }
    
    def password_reset_email(self, username: str, email: str, reset_token: str) -> Dict[str, str]:
        """Password reset email"""
        reset_url = f"{self.app_url}/reset-password?token={reset_token}"
        
        content = f"""
            <h2>🔐 Password Reset Request</h2>
            <p>Hi <strong>{username}</strong>,</p>
            <p>We received a request to reset your password for your {self.app_name} account.</p>
            
            <div class="highlight-box">
                <h3 style="margin-bottom: 12px;">Reset Your Password</h3>
                <p style="margin-bottom: 16px;">Click the button below to create a new password:</p>
                <div style="text-align: center;">
                    <a href="{reset_url}" class="cta-button">🔑 Reset Password</a>
                </div>
                <p style="font-size: 14px; color: #6b7280; margin-top: 16px;">This link will expire in 1 hour for security reasons.</p>
            </div>
            
            <div class="divider"></div>
            
            <h3>🔒 Security Information</h3>
            <ul style="margin-left: 20px; color: #4b5563;">
                <li style="margin-bottom: 8px;">This link is valid for 1 hour only</li>
                <li style="margin-bottom: 8px;">The link can only be used once</li>
                <li style="margin-bottom: 8px;">If you didn't request this reset, please ignore this email</li>
                <li style="margin-bottom: 8px;">Your account remains secure until you complete the reset</li>
            </ul>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <div class="api-key-box" style="font-size: 12px; word-break: break-all;">{reset_url}</div>
            
            <p>If you didn't request this password reset, please contact our support team immediately at <a href="mailto:{self.support_email}" style="color: #3b82f6;">{self.support_email}</a>.</p>
        """
        
        return {
            "subject": f"Reset your {self.app_name} password",
            "html": self.get_base_template().format(
                subject="Password Reset Request",
                header_subtitle="Secure your account",
                content=content,
                app_name=self.app_name,
                app_url=self.app_url,
                support_email=self.support_email,
                email=email
            ),
            "text": f"""Password Reset Request - {self.app_name}

Hi {username},

We received a request to reset your password for your {self.app_name} account.

Reset your password by clicking this link:
{reset_url}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email or contact our support team at {self.support_email}.

Best regards,
The {self.app_name} Team
"""
        }
    
    def monthly_usage_report(self, username: str, email: str, month: str, usage_stats: Dict[str, Any]) -> Dict[str, str]:
        """Monthly usage report email"""
        content = f"""
            <h2>📊 Monthly Usage Report - {month}</h2>
            <p>Hi <strong>{username}</strong>,</p>
            <p>Here's your monthly usage summary for {month}. Keep track of your API consumption and optimize your usage.</p>
            
            <div class="highlight-box">
                <h3 style="margin-bottom: 16px;">📈 Usage Summary</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="label">Total Requests</div>
                        <div class="value">{usage_stats.get('total_requests', 0):,}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Tokens Used</div>
                        <div class="value">{usage_stats.get('tokens_used', 0):,}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Credits Spent</div>
                        <div class="value">${usage_stats.get('credits_spent', 0):.2f}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Remaining Credits</div>
                        <div class="value">${usage_stats.get('remaining_credits', 0):.2f}</div>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{self.app_url}/settings/activity" class="cta-button">📊 View Detailed Analytics</a>
                <a href="{self.app_url}/billing" class="cta-button secondary-button">💳 Manage Billing</a>
            </div>
            
            <div class="divider"></div>
            
            <h3>💡 Usage Tips</h3>
            <ul style="margin-left: 20px; color: #4b5563;">
                <li style="margin-bottom: 8px;">Monitor your usage regularly to avoid unexpected charges</li>
                <li style="margin-bottom: 8px;">Set up usage alerts to stay informed</li>
                <li style="margin-bottom: 8px;">Consider upgrading your plan if you're consistently hitting limits</li>
                <li style="margin-bottom: 8px;">Use our cost calculator to estimate future usage</li>
            </ul>
            
            <p>Questions about your usage or need help optimizing? Contact our team at <a href="mailto:{self.support_email}" style="color: #3b82f6;">{self.support_email}</a>.</p>
        """
        
        return {
            "subject": f"Monthly Usage Report - {month} | {self.app_name}",
            "html": self.get_base_template().format(
                subject="Monthly Usage Report",
                header_subtitle="Your usage summary",
                content=content,
                app_name=self.app_name,
                app_url=self.app_url,
                support_email=self.support_email,
                email=email
            ),
            "text": f"""Monthly Usage Report - {self.app_name}

Hi {username},

Here's your monthly usage summary for {month}:

Total Requests: {usage_stats.get('total_requests', 0):,}
Tokens Used: {usage_stats.get('tokens_used', 0):,}
Credits Spent: ${usage_stats.get('credits_spent', 0):.2f}
Remaining Credits: ${usage_stats.get('remaining_credits', 0):.2f}

View detailed analytics: {self.app_url}/settings/activity
Manage billing: {self.app_url}/billing

Questions? Contact us: {self.support_email}

Best regards,
The {self.app_name} Team
"""
        }

# Global instance
email_templates = ProfessionalEmailTemplates(
    app_name=os.environ.get("APP_NAME", "Gatewayz"),
    app_url=os.environ.get("APP_URL", "https://beta.gatewayz.ai"),
    support_email=os.environ.get("SUPPORT_EMAIL", "support@gatewayz.ai")
)
