from .djangoise import TextChoices


class LogTag(TextChoices):
    CREATE = "CREATE", "Create"
    HOLD_AMOUNT = "HOLD_AMOUNT", "Hold amount"
    UNHOLD_AMOUNT = "UNHOLD_AMOUNT", "UnHold amount"
    TO_GATE = "TO_GATE", "To Gate"
    FROM_GATE = "FROM_GATE", "From Gate"
    TO_FISCAL = "TO_FISCAL", "To Fiscal"
    FETCH_STATUS = "FETCH_STATUS", "Fetch status"
    DONE = "DONE", "Done"
    ERROR = "ERROR", "Error"
    UNKNOWN = "UNKNOWN", "Unknown"
    ADDRESS_CHANGED = "ADDRESS_CHANGED", "Address changed"
    PROMOTED = "PROMOTED", "Promoted"


class OperationKind(TextChoices):
    # Управление карточным счётом. Выделяем, так как процессинг и тарифы
    #  отличаются от регулярного счёта
    CARD_OPEN = "CO", "CARD OPEN"
    CARD_UPDATE = "CU", "CARD UPDATE"
    CARD_TOPUP = "CT", "CARD TOPUP"
    CARD_BLOCK = "CB", "CARD BLOCK"
    CARD_RESTORE = "CR", "CARD RESTORE"
    CARD_CLOSE = "CC", "CARD CLOSE"
    CARD_BANNED = "CD", "CARD BANNED"

    # Операции по счёту. Движения средств. Типа DML
    DEPOSIT = "DE", "DEPOSIT"
    WITHDRAW = "WI", "WITHDRAW"
    SERVICE = "SE", "SERVICE"
    SYSTEM = "SY", "SYSTEM"
    ADJUSTMENT = "AJ", "ADJUSTMENT"
