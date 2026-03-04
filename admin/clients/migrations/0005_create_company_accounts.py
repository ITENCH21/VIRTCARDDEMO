"""
Data migration: создание системного клиента COMPANY и его аккаунтов
для приёма комиссий по всем активным валютам.

Fiscal-микросервис ожидает Account с client__user__username='COMPANY'
для каждой валюты, в которой проводятся комиссионные транзакции.
"""
from django.db import migrations


def create_company_accounts(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Client = apps.get_model("clients", "Client")
    Account = apps.get_model("clients", "Account")
    Currency = apps.get_model("currencies", "Currency")

    # 1. Создаём User 'COMPANY' (если ещё нет)
    user, _ = User.objects.get_or_create(
        username="COMPANY",
        defaults={
            "is_active": False,
            "first_name": "System",
            "last_name": "Company",
        },
    )

    # 2. Создаём Client для COMPANY (если ещё нет)
    client, _ = Client.objects.get_or_create(
        user=user,
        defaults={
            "name": "COMPANY",
            "status": "S",  # System
        },
    )

    # 3. Создаём Account для каждой активной валюты
    currencies = Currency.objects.filter()
    created = 0
    for currency in currencies:
        _, was_created = Account.objects.get_or_create(
            client=client,
            currency=currency,
            kind="D",  # Default
            defaults={
                "name": f"COMPANY {currency.code}",
                "status": "A",  # Active
                "amount_db": 0,
                "amount_holded_db": 0,
                "external_amount_db": 0,
            },
        )
        if was_created:
            created += 1

    print(f"\n  [0005] COMPANY: user={user.pk}, client={client.pk}, "
          f"accounts created: {created} (total currencies: {currencies.count()})")


def reverse_company_accounts(apps, schema_editor):
    """Обратная миграция — удаляем аккаунты COMPANY (но не User/Client)."""
    Account = apps.get_model("clients", "Account")
    Account.objects.filter(client__user__username="COMPANY").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("clients", "0004_alter_client_email_alter_client_phone"),
        ("currencies", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(
            create_company_accounts,
            reverse_code=reverse_company_accounts,
        ),
    ]
